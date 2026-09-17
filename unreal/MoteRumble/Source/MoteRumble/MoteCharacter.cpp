// Copyright Not Tim Games. All Rights Reserved.

#include "MoteCharacter.h"

#include "MoteProjectile.h"
#include "EngineUtils.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputActionValue.h"

AMoteCharacter::AMoteCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	// Compact capsule - the Mote is a small creature that floats.
	GetCapsuleComponent()->InitCapsuleSize(42.f, 52.f);

	// Top-down feel: the body turns to face where it's going.
	bUseControllerRotationYaw = false;
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->bOrientRotationToMovement = true;
	Move->RotationRate = FRotator(0.f, 720.f, 0.f);
	Move->MaxWalkSpeed = MoveSpeed;
	Move->GroundFriction = 6.f;
	Move->BrakingDecelerationWalking = 2600.f;
	Move->JumpZVelocity = 620.f;
	Move->AirControl = 0.65f;
	Move->GravityScale = 1.75f;

	// The skeletal mesh that ACharacter ships with is unused; the Mote is
	// assembled from primitives instead.
	if (GetMesh())
	{
		GetMesh()->SetVisibility(false);
		GetMesh()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(RootComponent);
	VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, HoverHeight));

	// Shared primitive meshes + material.
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(
		TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> ConeMesh(
		TEXT("/Engine/BasicShapes/Cone.Cone"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BaseMat(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));

	auto MakePiece = [&](const TCHAR* Name, UStaticMesh* MeshAsset, FVector Loc, FVector Scale)
	{
		UStaticMeshComponent* C = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		C->SetupAttachment(VisualRoot);
		C->SetRelativeLocation(Loc);
		C->SetRelativeScale3D(Scale);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->SetCastShadow(true);
		if (MeshAsset) { C->SetStaticMesh(MeshAsset); }
		if (BaseMat.Succeeded()) { C->SetMaterial(0, BaseMat.Object); }
		return C;
	};

	UStaticMesh* Sphere = SphereMesh.Succeeded() ? SphereMesh.Object : nullptr;
	UStaticMesh* Cube = CubeMesh.Succeeded() ? CubeMesh.Object : nullptr;
	UStaticMesh* Cone = ConeMesh.Succeeded() ? ConeMesh.Object : nullptr;

	// Teardrop body: a sphere pulled slightly tall.
	Body = MakePiece(TEXT("Body"), Sphere, FVector::ZeroVector, FVector(0.86f, 0.86f, 0.98f));

	// Detached orb hands - no arms connecting them. This is the silhouette.
	HandL = MakePiece(TEXT("HandL"), Sphere, FVector(14.f, -56.f, -6.f), FVector(0.26f));
	HandR = MakePiece(TEXT("HandR"), Sphere, FVector(14.f, 56.f, -6.f), FVector(0.26f));

	// A single wide visor instead of eyes.
	Visor = MakePiece(TEXT("Visor"), Cube, FVector(38.f, 0.f, 8.f), FVector(0.10f, 0.52f, 0.13f));

	// Chest crystal: reads the equipped Core at a glance.
	CoreCrystal = MakePiece(TEXT("CoreCrystal"), Cone, FVector(30.f, 0.f, -16.f), FVector(0.22f, 0.22f, 0.26f));

	CoreLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("CoreLight"));
	CoreLight->SetupAttachment(VisualRoot);
	CoreLight->SetRelativeLocation(FVector(0.f, 0.f, -26.f));
	CoreLight->SetIntensity(5000.f);
	CoreLight->SetAttenuationRadius(320.f);
	CoreLight->SetCastShadows(false);

	// Fixed top-down camera, angled so the arena reads well.
	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 1500.f;
	CameraBoom->SetRelativeRotation(FRotator(-58.f, 0.f, 0.f));
	CameraBoom->bDoCollisionTest = false;
	CameraBoom->bInheritPitch = false;
	CameraBoom->bInheritYaw = false;
	CameraBoom->bInheritRoll = false;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 6.f;

	TopDownCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("TopDownCamera"));
	TopDownCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	TopDownCamera->bUsePawnControlRotation = false;

	Health = MaxHealth;
}

void AMoteCharacter::BeginPlay()
{
	Super::BeginPlay();

	Health = MaxHealth;
	GetCharacterMovement()->MaxWalkSpeed = MoveSpeed;

	auto MakeMID = [&](UStaticMeshComponent* Comp) -> UMaterialInstanceDynamic*
	{
		return Comp ? Comp->CreateAndSetMaterialInstanceDynamic(0) : nullptr;
	};
	BodyMID = MakeMID(Body);
	HandLMID = MakeMID(HandL);
	HandRMID = MakeMID(HandR);
	CrystalMID = MakeMID(CoreCrystal);
	VisorMID = MakeMID(Visor);

	if (VisorMID)
	{
		VisorMID->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.05f, 0.07f, 0.12f));
	}

	// AI Motes don't need a camera fighting the player's for view target.
	if (!bWantsCamera && TopDownCamera)
	{
		TopDownCamera->SetActive(false);
	}

	ApplyCoreColor();
}

// ---------------------------------------------------------------------------
// Loadout
// ---------------------------------------------------------------------------

void AMoteCharacter::EquipCore(EMoteCore NewCore)
{
	CurrentCore = NewCore;
	CooldownPrimary = 0.f;
	CooldownSpecial = 0.f;
	ApplyCoreColor();
}

void AMoteCharacter::SetWantsCamera(bool bWants)
{
	bWantsCamera = bWants;
	if (TopDownCamera)
	{
		TopDownCamera->SetActive(bWants);
	}
}

void AMoteCharacter::SetBodyColor(const FLinearColor& InColor)
{
	BodyColor = InColor;
	if (BodyMID)
	{
		BodyMID->SetVectorParameterValue(TEXT("Color"), BodyColor);
	}
}

void AMoteCharacter::ApplyCoreColor()
{
	const FMoteCoreDef& Def = FMoteCoreLibrary::Get(CurrentCore);

	if (BodyMID)
	{
		BodyMID->SetVectorParameterValue(TEXT("Color"), BodyColor);
	}
	// Hands and crystal carry the Core's identity.
	if (HandLMID) { HandLMID->SetVectorParameterValue(TEXT("Color"), Def.Color); }
	if (HandRMID) { HandRMID->SetVectorParameterValue(TEXT("Color"), Def.Color); }
	if (CrystalMID) { CrystalMID->SetVectorParameterValue(TEXT("Color"), Def.Color * 1.6f); }
	if (CoreLight) { CoreLight->SetLightColor(Def.Color); }
}

// ---------------------------------------------------------------------------
// Frame update
// ---------------------------------------------------------------------------

void AMoteCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// ---- timers ----
	if (CooldownPrimary > 0.f) { CooldownPrimary = FMath::Max(0.f, CooldownPrimary - DeltaSeconds); }
	if (CooldownSpecial > 0.f) { CooldownSpecial = FMath::Max(0.f, CooldownSpecial - DeltaSeconds); }
	if (InvulnTimer > 0.f) { InvulnTimer -= DeltaSeconds; }
	if (FlashTimer > 0.f) { FlashTimer -= DeltaSeconds; }
	if (ReflectTimer > 0.f)
	{
		ReflectTimer -= DeltaSeconds;
		ReflectNearbyProjectiles();
	}
	if (ShieldBrokenTimer > 0.f)
	{
		ShieldBrokenTimer -= DeltaSeconds;
		if (ShieldBrokenTimer <= 0.f) { bShieldBroken = false; }
	}

	if (State == EMoteState::Downed)
	{
		return;
	}

	// ---- hurt recovery ----
	if (State == EMoteState::Hurt)
	{
		HurtTimer -= DeltaSeconds;
		if (HurtTimer <= 0.f) { State = EMoteState::Idle; }
	}

	// ---- shield ----
	const bool bCanShield = bShieldRequested && State == EMoteState::Idle
		&& !bShieldBroken && ShieldStamina > 0.02f;
	bShielding = bCanShield;

	if (bShielding)
	{
		ShieldStamina = FMath::Max(0.f, ShieldStamina - ShieldDrainPerSecond * DeltaSeconds);
		if (ShieldStamina <= 0.f)
		{
			bShielding = false;
			bShieldBroken = true;
			ShieldBrokenTimer = 1.1f;
			State = EMoteState::Hurt;
			HurtTimer = 0.5f;
		}
	}
	else
	{
		ShieldStamina = FMath::Min(1.f, ShieldStamina + ShieldRegenPerSecond * DeltaSeconds);
	}

	// ---- attack progression ----
	if (State == EMoteState::Attacking)
	{
		AttackTimer += DeltaSeconds;

		if (!bAttackResolved && AttackTimer >= ActiveAttack.WindUp)
		{
			bAttackResolved = true;
			ResolveAttack(ActiveAttack);
		}
		if (AttackTimer >= ActiveAttack.Duration)
		{
			State = EMoteState::Idle;
		}
	}

	// ---- movement ----
	const bool bCanMove = (State == EMoteState::Idle) && !bShielding;
	if (bCanMove && !MoveIntent.IsNearlyZero())
	{
		FVector Dir(MoveIntent.X, MoveIntent.Y, 0.f);
		Dir = Dir.GetClampedToMaxSize(1.f);
		AddMovementInput(Dir, 1.f);
	}
	// Input is re-asserted every frame by the controller or AI.
	MoveIntent = FVector2D::ZeroVector;

	// ---- hover bob + shield tell ----
	HoverPhase += DeltaSeconds * 2.6f;
	if (VisualRoot)
	{
		const float Bob = FMath::Sin(HoverPhase) * 5.f;
		VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, HoverHeight + Bob));
	}
	// Hands drift; they pull in tight when shielding.
	if (HandL && HandR)
	{
		const float Spread = bShielding ? 34.f : 56.f;
		const float HandBob = FMath::Sin(HoverPhase * 1.4f) * 3.f;
		HandL->SetRelativeLocation(FVector(14.f, -Spread, -6.f + HandBob));
		HandR->SetRelativeLocation(FVector(14.f, Spread, -6.f - HandBob));
	}

	// ---- damage flash: the Mote reddens, it never blinks out ----
	if (BodyMID)
	{
		const bool bFlash = (FlashTimer > 0.f)
			|| (InvulnTimer > 0.f && FMath::Fmod(InvulnTimer, 0.14f) > 0.07f);
		BodyMID->SetVectorParameterValue(TEXT("Color"),
			bFlash ? FLinearColor(1.f, 0.16f, 0.2f) : BodyColor);
	}
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

float AMoteCharacter::GetCooldownRemaining(EMoteAttackSlot Slot) const
{
	return (Slot == EMoteAttackSlot::Special) ? CooldownSpecial : CooldownPrimary;
}

bool AMoteCharacter::TryAttack(EMoteAttackSlot Slot)
{
	if (State != EMoteState::Idle || bShielding)
	{
		return false;
	}
	if (GetCooldownRemaining(Slot) > 0.f)
	{
		return false;
	}

	ActiveAttack = FMoteCoreLibrary::GetAttack(CurrentCore, Slot);
	ActiveSlot = Slot;
	AttackTimer = 0.f;
	bAttackResolved = false;
	State = EMoteState::Attacking;

	if (Slot == EMoteAttackSlot::Special) { CooldownSpecial = ActiveAttack.Cooldown; }
	else { CooldownPrimary = ActiveAttack.Cooldown; }

	// A Dash commits immediately so it reads as a lunge, not a wind-up.
	if (ActiveAttack.Shape == EMoteAttackShape::Dash)
	{
		DashDirection = GetActorForwardVector();
		const float Speed = ActiveAttack.DashDistance / FMath::Max(0.12f, ActiveAttack.Duration);
		LaunchCharacter(DashDirection * Speed, true, false);
	}

	if (ActiveAttack.bReflects)
	{
		ReflectTimer = ActiveAttack.Duration;
	}

	return true;
}

void AMoteCharacter::TryHop()
{
	if (State == EMoteState::Idle && !bShielding)
	{
		Jump();
	}
}

void AMoteCharacter::ResolveAttack(const FMoteAttackDef& Attack)
{
	switch (Attack.Shape)
	{
	case EMoteAttackShape::MeleeArc:
	case EMoteAttackShape::Spin:
	case EMoteAttackShape::Slam:
	case EMoteAttackShape::Dash:
		ResolveMelee(Attack);
		break;

	case EMoteAttackShape::Projectile:
	case EMoteAttackShape::Lob:
		FireProjectiles(Attack);
		break;

	default:
		break;
	}
}

void AMoteCharacter::ResolveMelee(const FMoteAttackDef& Attack)
{
	UWorld* World = GetWorld();
	if (!World) { return; }

	const FVector Origin = GetActorLocation();
	const FVector Forward = GetActorForwardVector();
	const bool bRadial = (Attack.Shape != EMoteAttackShape::MeleeArc);

	for (TActorIterator<AMoteCharacter> It(World); It; ++It)
	{
		AMoteCharacter* Target = *It;
		if (!Target || Target == this || Target->IsDowned())
		{
			continue;
		}

		const FVector Delta = Target->GetActorLocation() - Origin;
		const float Dist = Delta.Size2D();
		// Generous reach: the capsules are chunky relative to the arena.
		if (Dist > Attack.Range + GetCapsuleComponent()->GetScaledCapsuleRadius() + 40.f)
		{
			continue;
		}

		if (!bRadial)
		{
			const FVector ToTarget = Delta.GetSafeNormal2D();
			const float Dot = FVector::DotProduct(Forward, ToTarget);
			const float AngleDeg = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(Dot, -1.f, 1.f)));
			if (AngleDeg > Attack.ArcDegrees * 0.5f)
			{
				continue;
			}
		}

		Target->ReceiveHit(Attack.Damage, Delta.GetSafeNormal2D(), Attack.Knockback, this);
	}
}

void AMoteCharacter::FireProjectiles(const FMoteAttackDef& Attack)
{
	UWorld* World = GetWorld();
	if (!World) { return; }

	const FMoteCoreDef& Def = FMoteCoreLibrary::Get(CurrentCore);
	const int32 Count = FMath::Max(1, Attack.ProjectileCount);
	const float Spread = Attack.SpreadDegrees;
	const FVector Forward = GetActorForwardVector();
	const FVector Muzzle = GetActorLocation() + Forward * 70.f + FVector(0, 0, 10.f);

	for (int32 i = 0; i < Count; ++i)
	{
		float YawOffset = 0.f;
		if (Count > 1 && Spread > 0.f)
		{
			// Fan evenly across the spread, centred on forward.
			YawOffset = -Spread * 0.5f + (Spread * i) / (Count - 1);
		}

		const FVector Dir = Forward.RotateAngleAxis(YawOffset, FVector::UpVector);

		FActorSpawnParameters Params;
		Params.Owner = this;
		Params.Instigator = this;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

		AMoteProjectile* Shot = World->SpawnActor<AMoteProjectile>(
			AMoteProjectile::StaticClass(), Muzzle, Dir.Rotation(), Params);
		if (Shot)
		{
			Shot->Launch(this, Attack, Def.Color, Dir);
		}
	}
}

void AMoteCharacter::ReflectNearbyProjectiles()
{
	UWorld* World = GetWorld();
	if (!World) { return; }

	const FVector Origin = GetActorLocation();
	for (TActorIterator<AMoteProjectile> It(World); It; ++It)
	{
		AMoteProjectile* Shot = *It;
		if (!Shot || Shot->GetOwnerMote() == this)
		{
			continue;
		}
		if ((Shot->GetActorLocation() - Origin).SizeSquared2D() < FMath::Square(260.f))
		{
			Shot->Reflect(this);
		}
	}
}

void AMoteCharacter::ReceiveHit(float Damage, const FVector& Direction, float Knockback,
	AMoteCharacter* /*Attacker*/)
{
	if (State == EMoteState::Downed || InvulnTimer > 0.f)
	{
		return;
	}

	// Shield eats the hit but costs stamina; it can shatter.
	if (bShielding)
	{
		ShieldStamina = FMath::Max(0.f, ShieldStamina - (0.3f + Damage * 0.12f));
		InvulnTimer = 0.12f;
		if (ShieldStamina <= 0.f)
		{
			bShielding = false;
			bShieldBroken = true;
			ShieldBrokenTimer = 1.1f;
			State = EMoteState::Hurt;
			HurtTimer = 0.5f;
		}
		return;
	}

	Health = FMath::Max(0.f, Health - Damage);
	InvulnTimer = InvulnTime;
	FlashTimer = 0.22f;
	State = EMoteState::Hurt;
	HurtTimer = 0.32f;

	// Knock back and slightly up so hits pop.
	const FVector Launch = Direction.GetSafeNormal2D() * Knockback + FVector(0, 0, Knockback * 0.35f);
	LaunchCharacter(Launch, true, true);

	if (Health <= 0.f)
	{
		State = EMoteState::Downed;
		bShielding = false;
		GetCharacterMovement()->DisableMovement();
	}
}

void AMoteCharacter::ResetForRound()
{
	Health = MaxHealth;
	State = EMoteState::Idle;
	InvulnTimer = 1.0f;
	FlashTimer = 0.f;
	HurtTimer = 0.f;
	ReflectTimer = 0.f;
	CooldownPrimary = 0.f;
	CooldownSpecial = 0.f;
	ShieldStamina = 1.f;
	bShielding = false;
	bShieldRequested = false;
	bShieldBroken = false;
	ShieldBrokenTimer = 0.f;
	MoveIntent = FVector2D::ZeroVector;

	GetCharacterMovement()->SetMovementMode(MOVE_Walking);
	GetCharacterMovement()->StopMovementImmediately();
	ApplyCoreColor();
}

// ---------------------------------------------------------------------------
// Input - Enhanced Input assembled in C++, so the project needs no .uasset
// ---------------------------------------------------------------------------

void AMoteCharacter::BuildRuntimeInput()
{
	if (MappingContext)
	{
		return;
	}

	auto NewAction = [this](const TCHAR* Name)
	{
		UInputAction* A = NewObject<UInputAction>(this, Name);
		A->ValueType = EInputActionValueType::Boolean;
		return A;
	};

	IA_MoveFwd   = NewAction(TEXT("IA_MoveFwd"));
	IA_MoveBack  = NewAction(TEXT("IA_MoveBack"));
	IA_MoveLeft  = NewAction(TEXT("IA_MoveLeft"));
	IA_MoveRight = NewAction(TEXT("IA_MoveRight"));
	IA_Hop       = NewAction(TEXT("IA_Hop"));
	IA_Primary   = NewAction(TEXT("IA_Primary"));
	IA_Special   = NewAction(TEXT("IA_Special"));
	IA_Shield    = NewAction(TEXT("IA_Shield"));
	IA_CycleCore = NewAction(TEXT("IA_CycleCore"));

	MappingContext = NewObject<UInputMappingContext>(this, TEXT("IMC_Mote"));

	// Movement - WASD and arrows both work.
	MappingContext->MapKey(IA_MoveFwd, EKeys::W);
	MappingContext->MapKey(IA_MoveFwd, EKeys::Up);
	MappingContext->MapKey(IA_MoveBack, EKeys::S);
	MappingContext->MapKey(IA_MoveBack, EKeys::Down);
	MappingContext->MapKey(IA_MoveLeft, EKeys::A);
	MappingContext->MapKey(IA_MoveLeft, EKeys::Left);
	MappingContext->MapKey(IA_MoveRight, EKeys::D);
	MappingContext->MapKey(IA_MoveRight, EKeys::Right);

	// Same scheme the browser games settled on: Space hop, H/J attacks, K shield.
	MappingContext->MapKey(IA_Hop, EKeys::SpaceBar);
	MappingContext->MapKey(IA_Primary, EKeys::H);
	MappingContext->MapKey(IA_Primary, EKeys::X);
	MappingContext->MapKey(IA_Special, EKeys::J);
	MappingContext->MapKey(IA_Special, EKeys::Z);
	MappingContext->MapKey(IA_Shield, EKeys::K);
	MappingContext->MapKey(IA_Shield, EKeys::LeftShift);
	MappingContext->MapKey(IA_CycleCore, EKeys::Tab);
}

void AMoteCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	BuildRuntimeInput();

	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (ULocalPlayer* LP = PC->GetLocalPlayer())
		{
			if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
				LP->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
			{
				Subsystem->AddMappingContext(MappingContext, 0);
			}
		}
	}

	if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		// Held every frame.
		EIC->BindAction(IA_MoveFwd,   ETriggerEvent::Triggered, this, &AMoteCharacter::OnMoveFwd);
		EIC->BindAction(IA_MoveBack,  ETriggerEvent::Triggered, this, &AMoteCharacter::OnMoveBack);
		EIC->BindAction(IA_MoveLeft,  ETriggerEvent::Triggered, this, &AMoteCharacter::OnMoveLeft);
		EIC->BindAction(IA_MoveRight, ETriggerEvent::Triggered, this, &AMoteCharacter::OnMoveRight);

		// Edge-triggered.
		EIC->BindAction(IA_Hop,       ETriggerEvent::Started, this, &AMoteCharacter::OnHop);
		EIC->BindAction(IA_Primary,   ETriggerEvent::Started, this, &AMoteCharacter::OnPrimary);
		EIC->BindAction(IA_Special,   ETriggerEvent::Started, this, &AMoteCharacter::OnSpecial);
		EIC->BindAction(IA_CycleCore, ETriggerEvent::Started, this, &AMoteCharacter::OnCycleCore);

		// Hold to shield.
		EIC->BindAction(IA_Shield, ETriggerEvent::Started,   this, &AMoteCharacter::OnShieldPressed);
		EIC->BindAction(IA_Shield, ETriggerEvent::Completed, this, &AMoteCharacter::OnShieldReleased);
		EIC->BindAction(IA_Shield, ETriggerEvent::Canceled,  this, &AMoteCharacter::OnShieldReleased);
	}
}

void AMoteCharacter::OnMoveFwd(const FInputActionValue&)   { MoveIntent.X += 1.f; }
void AMoteCharacter::OnMoveBack(const FInputActionValue&)  { MoveIntent.X -= 1.f; }
void AMoteCharacter::OnMoveLeft(const FInputActionValue&)  { MoveIntent.Y -= 1.f; }
void AMoteCharacter::OnMoveRight(const FInputActionValue&) { MoveIntent.Y += 1.f; }
void AMoteCharacter::OnHop(const FInputActionValue&)       { TryHop(); }
void AMoteCharacter::OnPrimary(const FInputActionValue&)   { TryAttack(EMoteAttackSlot::Primary); }
void AMoteCharacter::OnSpecial(const FInputActionValue&)   { TryAttack(EMoteAttackSlot::Special); }
void AMoteCharacter::OnShieldPressed(const FInputActionValue&)  { SetShielding(true); }
void AMoteCharacter::OnShieldReleased(const FInputActionValue&) { SetShielding(false); }

void AMoteCharacter::OnCycleCore(const FInputActionValue&)
{
	// Handy while there's no menu yet: Tab walks through the eight Cores.
	const int32 Next = (static_cast<int32>(CurrentCore) + 1) % static_cast<int32>(EMoteCore::Count);
	EquipCore(static_cast<EMoteCore>(Next));
}
