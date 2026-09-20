// Copyright Not Tim Games. All Rights Reserved.

#include "MoteCharacter.h"

#include "MoteAnimator.h"
#include "MoteArena.h"
#include "MoteAudio.h"
#include "MoteEvents.h"
#include "MoteFX.h"
#include "MoteGameMode.h"
#include "MoteProjectile.h"

#include "Components/CapsuleComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	constexpr float CapsuleRadius = 46.f;
	constexpr float CapsuleHalfHeight = 64.f;
	constexpr float InputBuffer = 0.13f;
	constexpr float GroundTurnRate = 1440.f;
	constexpr float AirTurnRate = 540.f;
	constexpr float RollDuration = 0.42f;
	constexpr float AirDodgeDuration = 0.46f;

	const TCHAR* SphereMeshPath = TEXT("/Engine/BasicShapes/Sphere.Sphere");
	const TCHAR* CubeMeshPath = TEXT("/Engine/BasicShapes/Cube.Cube");
	const TCHAR* BasicMaterialPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");
	const TCHAR* OverlayMaterialPath = TEXT("/Game/FX/M_FX_Overlay.M_FX_Overlay");
	const TCHAR* ShieldMaterialPath = TEXT("/Game/FX/M_FX_Shield.M_FX_Shield");

	/** Shortest distance from P to segment AB. */
	float DistToSegment(const FVector& P, const FVector& A, const FVector& B)
	{
		const FVector AB = B - A;
		const float T = FMath::Clamp(FVector::DotProduct(P - A, AB) / FMath::Max(AB.SizeSquared(), 1.f), 0.f, 1.f);
		return FVector::Dist(P, A + AB * T);
	}
}

// ============================================================================
//  Construction
// ============================================================================

AMoteCharacter::AMoteCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	UCapsuleComponent* Capsule = GetCapsuleComponent();
	Capsule->InitCapsuleSize(CapsuleRadius, CapsuleHalfHeight);
	// Fighters pass through each other (a soft push in Tick keeps them apart),
	// exactly like a platform fighter.
	Capsule->SetCollisionResponseToChannel(ECC_Pawn, ECR_Ignore);
	Capsule->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);

	bUseControllerRotationYaw = false;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->bOrientRotationToMovement = false;
	Move->MaxWalkSpeed = 820.f;
	Move->MaxAcceleration = 5200.f;
	Move->GroundFriction = 9.f;
	Move->BrakingDecelerationWalking = 4200.f;
	Move->BrakingDecelerationFalling = 0.f;
	Move->AirControl = 0.85f;
	Move->AirControlBoostMultiplier = 1.f;
	Move->GravityScale = 2.4f;
	Move->JumpZVelocity = 1050.f;
	Move->MaxStepHeight = 20.f;
	Move->bCanWalkOffLedges = true;
	Move->bUseFlatBaseForFloorChecks = true;
	Move->SetWalkableFloorAngle(50.f);

	if (GetMesh())
	{
		GetMesh()->SetVisibility(false);
		GetMesh()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereFinder(SphereMeshPath);
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BasicMatFinder(BasicMaterialPath);

	auto MakeMesh = [this](const TCHAR* Name, USceneComponent* Parent)
	{
		UStaticMeshComponent* C = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		C->SetupAttachment(Parent);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->SetGenerateOverlapEvents(false);
		C->SetCastShadow(true);
		return C;
	};

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	VisualRoot->SetupAttachment(Capsule);
	VisualRoot->SetRelativeLocation(FVector(0.f, 0.f, HoverHeight));

	BodyPivot = CreateDefaultSubobject<USceneComponent>(TEXT("BodyPivot"));
	BodyPivot->SetupAttachment(VisualRoot);

	BodyMesh = MakeMesh(TEXT("BodyMesh"), BodyPivot);
	GauntletL = MakeMesh(TEXT("GauntletL"), VisualRoot);
	GauntletR = MakeMesh(TEXT("GauntletR"), VisualRoot);

	WeaponPivot = CreateDefaultSubobject<USceneComponent>(TEXT("WeaponPivot"));
	WeaponPivot->SetupAttachment(VisualRoot);
	WeaponMesh = MakeMesh(TEXT("WeaponMesh"), WeaponPivot);

	ShieldBubble = MakeMesh(TEXT("ShieldBubble"), VisualRoot);
	ShieldBubble->SetCastShadow(false);
	ShieldBubble->SetVisibility(false);
	if (SphereFinder.Succeeded())
	{
		ShieldBubble->SetStaticMesh(SphereFinder.Object);
	}
	if (BasicMatFinder.Succeeded())
	{
		ShieldBubble->SetMaterial(0, BasicMatFinder.Object);
	}

	CoreLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("CoreLight"));
	CoreLight->SetupAttachment(VisualRoot);
	CoreLight->SetRelativeLocation(FVector(40.f, 0.f, -10.f));
	CoreLight->SetIntensityUnits(ELightUnits::Candelas);
	CoreLight->SetIntensity(5.f);
	CoreLight->SetAttenuationRadius(260.f);
	CoreLight->SetCastShadows(false);

	Animator = CreateDefaultSubobject<UMoteAnimator>(TEXT("Animator"));

	Trail = CreateDefaultSubobject<UMoteWeaponTrail>(TEXT("Trail"));
	Trail->SetupAttachment(Capsule);

	AutoPossessAI = EAutoPossessAI::Disabled;
}

void AMoteCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (UMaterialInterface* OverlayMat = LoadObject<UMaterialInterface>(nullptr, OverlayMaterialPath, nullptr, LOAD_Quiet | LOAD_NoWarn))
	{
		OverlayMID = UMaterialInstanceDynamic::Create(OverlayMat, this);
	}
	if (UMaterialInterface* ShieldMat = LoadObject<UMaterialInterface>(nullptr, ShieldMaterialPath, nullptr, LOAD_Quiet | LOAD_NoWarn))
	{
		ShieldMID = UMaterialInstanceDynamic::Create(ShieldMat, this);
	}
	else if (ShieldBubble)
	{
		ShieldMID = ShieldBubble->CreateAndSetMaterialInstanceDynamic(0);
	}
	if (ShieldMID && ShieldBubble)
	{
		ShieldBubble->SetMaterial(0, ShieldMID);
	}

	ApplyFighterVisuals();
}

// ============================================================================
//  Fighter setup
// ============================================================================

const FMoteFighterDef& AMoteCharacter::GetFighterDef() const
{
	return FMoteRoster::Get(Core);
}

FLinearColor AMoteCharacter::GetAccent() const
{
	return GetFighterDef().Accent;
}

void AMoteCharacter::SetFighter(EMoteCore NewCore)
{
	Core = NewCore;
	const FMoteFighterDef& Def = GetFighterDef();

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->MaxWalkSpeed = Def.RunSpeed;
	Move->GravityScale = Def.GravityScale;
	Move->JumpZVelocity = Def.JumpVelocity;
	HoverLeft = Def.HoverTime;

	if (HasActorBegunPlay())
	{
		ApplyFighterVisuals();
	}
}

void AMoteCharacter::FitMesh(UStaticMeshComponent* Comp, UStaticMesh* MeshAsset, float TargetSize, bool bUseHeight)
{
	if (!Comp || !MeshAsset)
	{
		return;
	}
	Comp->SetStaticMesh(MeshAsset);

	const FBox Box = MeshAsset->GetBoundingBox();
	const FVector Size = Box.GetSize();
	const float Measure = bUseHeight ? Size.Z : Size.GetMax();
	const float Scale = TargetSize / FMath::Max(Measure, 1.f);

	// Keep any mirroring already on the component (the left gauntlet is flipped in Y).
	const FVector Current = Comp->GetRelativeScale3D();
	const FVector Sign(Current.X < 0.f ? -1.f : 1.f, Current.Y < 0.f ? -1.f : 1.f, Current.Z < 0.f ? -1.f : 1.f);
	const FVector Scale3 = Sign * Scale;
	Comp->SetRelativeScale3D(Scale3);

	// Centre the mesh's bounds on the parent's origin.
	const FVector Centre = Box.GetCenter() * Scale3;
	Comp->SetRelativeLocation(-Comp->GetRelativeRotation().RotateVector(Centre));
}

void AMoteCharacter::MountWeapon(UStaticMesh* MeshAsset)
{
	const FMoteFighterDef& Def = GetFighterDef();
	const FMoteWeaponMount& Mount = Def.Mount;

	if (!MeshAsset)
	{
		WeaponMesh->SetStaticMesh(nullptr);
		WeaponMesh->SetVisibility(false);
		WeaponReach = 60.f;
		return;
	}

	WeaponMesh->SetStaticMesh(MeshAsset);
	WeaponMesh->SetVisibility(true);

	const FBox Box = MeshAsset->GetBoundingBox();
	const FVector Size = Box.GetSize();

	// Align the mesh's longest axis with +X.
	FRotator AlignRot = FRotator::ZeroRotator;
	if (Size.Z >= Size.X && Size.Z >= Size.Y)
	{
		AlignRot = FRotator(-90.f, 0.f, 0.f);  // Z -> X
	}
	else if (Size.Y >= Size.X)
	{
		AlignRot = FRotator(0.f, -90.f, 0.f);  // Y -> X
	}
	FQuat Q = AlignRot.Quaternion();
	if (Mount.bFlipLongAxis)
	{
		Q = FRotator(0.f, 180.f, 0.f).Quaternion() * Q;
	}
	Q = Mount.ExtraRotation.Quaternion() * Q;

	const float Longest = FMath::Max(Size.GetMax(), 1.f);
	const float Scale = Mount.Length / Longest;
	WeaponMesh->SetRelativeScale3D(FVector(Scale));
	WeaponMesh->SetRelativeRotation(Q);

	// Put the grip on the pivot: centre the bounds, then slide along X.
	const FVector RotatedCentre = Q.RotateVector(Box.GetCenter() * Scale);
	WeaponMesh->SetRelativeLocation(-RotatedCentre - FVector(Mount.GripFraction * Mount.Length, 0.f, 0.f));

	WeaponReach = Mount.Length * (0.5f - Mount.GripFraction);
}

void AMoteCharacter::ApplyFighterVisuals()
{
	const FMoteFighterDef& Def = GetFighterDef();
	bVisualsApplied = true;

	UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, SphereMeshPath);
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, CubeMeshPath);
	UMaterialInterface* BasicMat = LoadObject<UMaterialInterface>(nullptr, BasicMaterialPath);

	auto LoadOr = [](const FString& Path) -> UStaticMesh*
	{
		return Path.IsEmpty() ? nullptr : LoadObject<UStaticMesh>(nullptr, *Path, nullptr, LOAD_Quiet | LOAD_NoWarn);
	};
	auto Tinted = [this, BasicMat](const FLinearColor& Color) -> UMaterialInstanceDynamic*
	{
		UMaterialInstanceDynamic* MID = BasicMat ? UMaterialInstanceDynamic::Create(BasicMat, this) : nullptr;
		if (MID)
		{
			MID->SetVectorParameterValue(TEXT("Color"), Color);
		}
		return MID;
	};

	// ---- body ----
	UStaticMesh* BodyAsset = LoadOr(Def.BodyMesh);
	const bool bBodyFallback = (BodyAsset == nullptr);
	BodyMesh->EmptyOverrideMaterials();
	BodyMesh->SetRelativeRotation(FRotator(0.f, Def.BodyYawOffset, 0.f));
	BodyMesh->SetRelativeScale3D(FVector::OneVector);
	FitMesh(BodyMesh, bBodyFallback ? Sphere : BodyAsset, Def.BodyHeight, true);
	if (bBodyFallback)
	{
		// Egg-ish primitive stand-in until the art is imported.
		BodyMesh->SetRelativeScale3D(BodyMesh->GetRelativeScale3D() * FVector(0.82f, 0.82f, 1.f));
		BodyMesh->SetMaterial(0, Tinted(Def.Accent * 0.55f + Def.Secondary * 0.25f));
	}

	// ---- gauntlets ----
	UStaticMesh* GauntletAsset = LoadOr(Def.GauntletMesh);
	const bool bGauntletFallback = (GauntletAsset == nullptr);
	GauntletR->SetRelativeScale3D(FVector::OneVector);
	GauntletL->SetRelativeScale3D(FVector(1.f, -1.f, 1.f));  // mirrored
	GauntletR->SetRelativeRotation(Def.GauntletRotation);
	GauntletL->SetRelativeRotation(Def.GauntletRotation);
	for (UStaticMeshComponent* G : { GauntletL.Get(), GauntletR.Get() })
	{
		G->EmptyOverrideMaterials();
		FitMesh(G, bGauntletFallback ? Sphere : GauntletAsset, Def.GauntletSize, false);
		if (bGauntletFallback)
		{
			G->SetMaterial(0, Tinted(Def.Accent));
		}
	}

	// ---- weapon ----
	WeaponMesh->EmptyOverrideMaterials();
	WeaponMesh->SetHiddenInGame(false);
	UStaticMesh* WeaponAsset = LoadOr(Def.WeaponMesh);
	if (Def.Hold == EMoteWeaponHold::Gauntlets)
	{
		MountWeapon(nullptr);
	}
	else if (!WeaponAsset)
	{
		// Primitive stand-in: a long bar (or a ball for bombs).
		const bool bBall = (Def.Hold == EMoteWeaponHold::BombRight);
		MountWeapon(bBall ? Sphere : Cube);
		if (!bBall)
		{
			WeaponMesh->SetRelativeRotation(FRotator::ZeroRotator);
			WeaponMesh->SetRelativeScale3D(FVector(Def.Mount.Length / 100.f, 0.10f, 0.22f));
			WeaponMesh->SetRelativeLocation(FVector(-Def.Mount.GripFraction * Def.Mount.Length, 0.f, 0.f));
		}
		WeaponMesh->SetMaterial(0, Tinted(Def.Secondary));
	}
	else
	{
		MountWeapon(WeaponAsset);
	}

	// ---- overlays (hit flash / rim) ----
	for (UStaticMeshComponent* C : { BodyMesh.Get(), GauntletL.Get(), GauntletR.Get(), WeaponMesh.Get() })
	{
		if (C && OverlayMID)
		{
			C->SetOverlayMaterial(OverlayMID);
		}
	}

	CoreLight->SetLightColor(Def.Accent);
	if (Trail)
	{
		Trail->SetColor(Def.Accent);
		Trail->Clear();
	}

	if (Animator)
	{
		Animator->Initialize(BodyPivot, GauntletL, GauntletR, WeaponPivot, WeaponMesh, Def, Def.BodyHeight, WeaponReach);
	}
}

// ============================================================================
//  Button API
// ============================================================================

void AMoteCharacter::SetMoveInput(const FVector2D& WorldDir)
{
	MoveInput = WorldDir.GetClampedToMaxSize(1.f);
}

void AMoteCharacter::PressJump()
{
	BufferJump = InputBuffer;
	bJumpHeld = true;
}

void AMoteCharacter::SetJumpHeld(bool bHeld)
{
	bJumpHeld = bHeld;
}

void AMoteCharacter::PressLight()
{
	BufferLight = InputBuffer;
	if (State == EMoteFighterState::Respawning)
	{
		RespawnHoldTimer = MoteTuning::RespawnHoldMax;
	}
}

void AMoteCharacter::PressHeavy()
{
	BufferHeavy = InputBuffer;
	bHeavyHeld = true;
	if (State == EMoteFighterState::Respawning)
	{
		RespawnHoldTimer = MoteTuning::RespawnHoldMax;
	}
}

void AMoteCharacter::ReleaseHeavy()
{
	bHeavyHeld = false;
}

void AMoteCharacter::SetShieldHeld(bool bHeld)
{
	bShieldHeld = bHeld;
}

void AMoteCharacter::PressDodge()
{
	PressDodge(MoveInput);
}

void AMoteCharacter::PressDodge(const FVector2D& Dir)
{
	// Remember the aim now: MoveInput can be rewritten several times before the
	// buffer is consumed, which sent every AI roll the wrong way.
	BufferDodgeDir = Dir.GetClampedToMaxSize(1.f);
	BufferDodge = InputBuffer;
}

// ============================================================================
//  Match flow
// ============================================================================

void AMoteCharacter::ResetForMatch(const FVector& Location, float Yaw)
{
	SetActorLocation(Location, false, nullptr, ETeleportType::ResetPhysics);
	SetActorRotation(FRotator(0.f, Yaw, 0.f));

	ShieldHP = MoteTuning::ShieldMax;
	InvulnTimer = 0.f;
	HitstunTimer = 0.f;
	HitstopTimer = 0.f;
	CustomTimeDilation = 1.f;
	FlashTimer = 0.f;
	ComboCount = 0;
	ComboVictim.Reset();
	LastAttacker.Reset();
	AirJumpsUsed = 0;
	HoverLeft = GetFighterDef().HoverTime;
	bAirDodgeUsed = false;
	BufferLight = BufferHeavy = BufferJump = BufferDodge = 0.f;
	bHeavyHeld = bShieldHeld = bJumpHeld = false;
	MoveInput = FVector2D::ZeroVector;
	Phase = EMoteMovePhase::None;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->SetMovementMode(MOVE_Falling);
	Move->StopMovementImmediately();
	Move->GravityScale = GetFighterDef().GravityScale;

	VisualRoot->SetVisibility(true, true);
	ShieldBubble->SetVisibility(false);
	if (Trail) { Trail->Clear(); }

	SetState(EMoteFighterState::Idle);
}

void AMoteCharacter::BeginRespawn(const FVector& HaloLocation, float Yaw)
{
	RespawnHalo = HaloLocation;
	SetActorLocation(HaloLocation, false, nullptr, ETeleportType::ResetPhysics);
	SetActorRotation(FRotator(0.f, Yaw, 0.f));
	// A KO claim must not outlive the stock it belongs to, or a later
	// self-destruct is credited to whoever last landed a hit.
	LastAttacker.Reset();
	Percent = 0.f;
	ShieldHP = MoteTuning::ShieldMax;
	HitstunTimer = 0.f;
	HitstopTimer = 0.f;
	CustomTimeDilation = 1.f;
	AirJumpsUsed = 0;
	bAirDodgeUsed = false;
	HoverLeft = GetFighterDef().HoverTime;
	RespawnHoldTimer = 0.f;
	Phase = EMoteMovePhase::None;
	BufferLight = BufferHeavy = BufferJump = BufferDodge = 0.f;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->SetMovementMode(MOVE_Flying);
	Move->StopMovementImmediately();
	Move->GravityScale = GetFighterDef().GravityScale;

	VisualRoot->SetVisibility(true, true);
	ShieldBubble->SetVisibility(false);
	if (Trail) { Trail->Clear(); }

	SetState(EMoteFighterState::Respawning);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->RespawnBeam(HaloLocation, GetAccent());
	}
	PlaySfx(TEXT("sfx_respawn"), 0.8f, 0.f);
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->OnRespawn.Broadcast(this);
	}
}

void AMoteCharacter::ResetStats()
{
	Percent = 0.f;
	StatDamageDealt = 0.f;
	StatKOs = 0;
	StatFalls = 0;
	StatMaxCombo = 0.f;
}

void AMoteCharacter::EnterKO()
{
	// The Results transition and the intro beam-in both re-enter KO on a
	// fighter that is already KO'd; only a real blast counts as a fall.
	const bool bAlreadyKO = (State == EMoteFighterState::KO);
	SetState(EMoteFighterState::KO);
	Phase = EMoteMovePhase::None;
	HitstopTimer = 0.f;
	CustomTimeDilation = 1.f;
	GetCharacterMovement()->StopMovementImmediately();
	GetCharacterMovement()->SetMovementMode(MOVE_None);
	VisualRoot->SetVisibility(false, true);
	if (Trail) { Trail->Clear(); }
	if (!bAlreadyKO)
	{
		++StatFalls;
	}
}

void AMoteCharacter::SetInactive()
{
	SetState(EMoteFighterState::Inactive);
	Phase = EMoteMovePhase::None;
	GetCharacterMovement()->StopMovementImmediately();
	ShieldBubble->SetVisibility(false);
}

void AMoteCharacter::EnterVictory()
{
	Phase = EMoteMovePhase::None;
	ShieldBubble->SetVisibility(false);
	HitstopTimer = 0.f;
	CustomTimeDilation = 1.f;
	SetState(EMoteFighterState::Victory);
}

// ============================================================================
//  Queries
// ============================================================================

bool AMoteCharacter::IsGrounded() const
{
	return GetCharacterMovement() && GetCharacterMovement()->IsMovingOnGround();
}

FBox AMoteCharacter::GetVisualBounds() const
{
	FBox Box(ForceInit);
	for (const UStaticMeshComponent* C : { BodyMesh.Get(), GauntletL.Get(), GauntletR.Get(), WeaponMesh.Get() })
	{
		if (C && C->IsVisible() && C->GetStaticMesh())
		{
			Box += C->Bounds.GetBox();
		}
	}
	return Box;
}

int32 AMoteCharacter::GetAirJumpsLeft() const
{
	return FMath::Max(0, GetFighterDef().AirJumps - AirJumpsUsed);
}

const FMoteMoveDef* AMoteCharacter::GetCurrentMove() const
{
	return (State == EMoteFighterState::Attacking) ? &GetFighterDef().GetMove(MoveSlot) : nullptr;
}

FVector AMoteCharacter::GetFacing() const
{
	FVector F = GetActorForwardVector();
	F.Z = 0.f;
	return F.GetSafeNormal(UE_SMALL_NUMBER, FVector::ForwardVector);
}

FVector AMoteCharacter::GetWeaponTipLocation() const
{
	if (Animator)
	{
		return Animator->GetStrikePoint();
	}
	return WeaponPivot ? WeaponPivot->GetComponentTransform().TransformPosition(FVector(WeaponReach, 0.f, 0.f))
		: GetActorLocation();
}

FVector AMoteCharacter::GetCoreLocation() const
{
	return BodyPivot ? BodyPivot->GetComponentLocation() + GetFacing() * 30.f : GetActorLocation();
}

FMoteAnimState AMoteCharacter::GetAnimState() const
{
	FMoteAnimState S;
	S.State = State;
	S.StateTime = StateTime;
	S.MoveSlot = MoveSlot;
	S.Phase = (State == EMoteFighterState::Attacking) ? Phase : EMoteMovePhase::None;
	S.ComboIndex = ComboIndex;
	S.Time = WorldTime;

	if (State == EMoteFighterState::Attacking)
	{
		const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
		S.MoveAnim = M.Anim;
		S.Charge01 = M.bChargeable ? FMath::Clamp(ChargeTime / FMath::Max(M.MaxCharge, 0.01f), 0.f, 1.f) : 0.f;
		float PhaseLen = 1.f;
		float Before = 0.f;
		switch (Phase)
		{
		case EMoteMovePhase::Charging: PhaseLen = M.MaxCharge; break;
		case EMoteMovePhase::Startup:  PhaseLen = M.Startup; break;
		case EMoteMovePhase::Active:   PhaseLen = M.bPlungeUntilLanding ? 0.6f : M.Active; Before = M.Startup; break;
		case EMoteMovePhase::Recovery: PhaseLen = M.Recovery; Before = M.Startup + M.Active; break;
		default: break;
		}
		if (Phase == EMoteMovePhase::Charging)
		{
			S.PhaseAlpha = S.Charge01;
			S.MoveAlpha = 0.f;
		}
		else
		{
			S.PhaseAlpha = FMath::Clamp(PhaseTime / FMath::Max(PhaseLen, 0.001f), 0.f, 1.f);
			const float Elapsed = Before + FMath::Min(PhaseTime, PhaseLen);
			S.MoveAlpha = FMath::Clamp(Elapsed / FMath::Max(M.TotalTime(), 0.001f), 0.f, 1.f);
		}
	}

	const UCharacterMovementComponent* Move = GetCharacterMovement();
	S.Velocity = Move ? Move->Velocity : FVector::ZeroVector;
	S.Speed01 = FMath::Clamp(S.Velocity.Size2D() / FMath::Max(GetFighterDef().RunSpeed, 1.f), 0.f, 1.5f);
	S.bGrounded = IsGrounded();
	S.bHovering = bHovering;
	S.TimeSinceJump = TimeSinceJump;
	S.TimeSinceLanded = TimeSinceLanded;
	S.AirJumpsUsed = AirJumpsUsed;
	S.Shield01 = GetShield01();
	S.DodgeDirection = DodgeDir;
	S.HitstunRemaining = HitstunTimer;
	S.bTumble = bTumble;
	S.LaunchDirection = LaunchVel.GetSafeNormal();
	S.bInHitstop = HitstopTimer > 0.f;
	S.bHitstopVictim = bHitstopVictim;
	S.TimeSinceHurt = TimeSinceHurt;
	return S;
}

// ============================================================================
//  Tick
// ============================================================================

void AMoteCharacter::SetState(EMoteFighterState NewState)
{
	if (State == EMoteFighterState::Respawning && NewState != EMoteFighterState::Respawning)
	{
		if (const AMoteGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr)
		{
			if (GM->GetArena())
			{
				GM->GetArena()->ShowRespawnHalo(PlayerIndex, RespawnHalo, GetAccent(), false);
			}
		}
	}
	State = NewState;
	StateTime = 0.f;
	if (State != EMoteFighterState::Shielding && ShieldBubble)
	{
		ShieldBubble->SetVisibility(false);
	}
}

bool AMoteCharacter::CanAct() const
{
	return State == EMoteFighterState::Idle && !bControlsLocked;
}

void AMoteCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// World delta ignores this actor's own time dilation, which is how hitstop
	// freezes us - so everything that must run during a freeze uses it.
	const float WorldDt = GetWorld() ? GetWorld()->GetDeltaSeconds() : DeltaSeconds;
	WorldTime += WorldDt;

	if (HitstopTimer > 0.f)
	{
		HitstopTimer -= WorldDt;
		if (HitstopTimer <= 0.f)
		{
			HitstopTimer = 0.f;
			CustomTimeDilation = 1.f;
		}
		TickPresentation(0.f, WorldDt);
		return;
	}

	const float Dt = DeltaSeconds;
	TickTimers(Dt);

	switch (State)
	{
	case EMoteFighterState::Inactive:
	case EMoteFighterState::KO:
	case EMoteFighterState::Victory:
		break;

	case EMoteFighterState::Respawning:
	{
		RespawnHoldTimer += Dt;
		SetActorLocation(RespawnHalo + FVector(0.f, 0.f, FMath::Sin(WorldTime * 2.4f) * 8.f));
		const bool bWantsDrop = !MoveInput.IsNearlyZero() || BufferJump > 0.f || BufferDodge > 0.f;
		if (!bControlsLocked && ((bWantsDrop && RespawnHoldTimer > 0.4f) || RespawnHoldTimer >= MoteTuning::RespawnHoldMax))
		{
			GetCharacterMovement()->SetMovementMode(MOVE_Falling);
			InvulnTimer = MoteTuning::RespawnInvuln;
			BufferJump = 0.f;
			SetState(EMoteFighterState::Idle);
		}
		break;
	}

	case EMoteFighterState::Hitstun:
		TickHitstun(Dt);
		TickMovement(Dt);
		break;

	case EMoteFighterState::ShieldBroken:
		ShieldStunTimer -= Dt;
		if (ShieldStunTimer <= 0.f)
		{
			ShieldHP = MoteTuning::ShieldMax * 0.6f;
			SetState(EMoteFighterState::Idle);
		}
		TickMovement(Dt);
		break;

	case EMoteFighterState::Dodging:
		TickDodge(Dt);
		break;

	case EMoteFighterState::Shielding:
		TickShield(Dt);
		break;

	case EMoteFighterState::Attacking:
		TickAttack(Dt);
		TickMovement(Dt);
		break;

	case EMoteFighterState::Idle:
	default:
	{
		const bool bGrounded = IsGrounded();
		bool bActed = false;

		if (!bControlsLocked)
		{
			if (BufferDodge > 0.f && (bGrounded || !bAirDodgeUsed))
			{
				BufferDodge = 0.f;
				StartDodge(FVector(BufferDodgeDir.X, BufferDodgeDir.Y, 0.f));
				bActed = true;
			}
			else if (bShieldHeld && bGrounded && ShieldHP > 1.f)
			{
				SetState(EMoteFighterState::Shielding);
				ShieldStunTimer = 0.f;
				PlaySfx(TEXT("sfx_shield_block"), 0.25f);
				bActed = true;
			}
			else
			{
				if (BufferJump > 0.f)
				{
					if (bGrounded)
					{
						BufferJump = 0.f;
						DoJump(false);
					}
					else if (AirJumpsUsed < GetFighterDef().AirJumps)
					{
						BufferJump = 0.f;
						DoJump(true);
					}
				}
				if (BufferLight > 0.f)
				{
					BufferLight = 0.f;
					StartMove(IsGrounded() ? EMoteMoveSlot::Jab1 : EMoteMoveSlot::AirLight);
					bActed = true;
				}
				else if (BufferHeavy > 0.f)
				{
					BufferHeavy = 0.f;
					StartMove(IsGrounded() ? EMoteMoveSlot::Heavy : EMoteMoveSlot::AirHeavy);
					bActed = true;
				}
			}
		}
		if (!bActed || State == EMoteFighterState::Attacking)
		{
			TickMovement(Dt);
		}
		break;
	}
	}

	// Shield regenerates whenever it isn't up.
	if (State != EMoteFighterState::Shielding && State != EMoteFighterState::ShieldBroken)
	{
		ShieldHP = FMath::Min(MoteTuning::ShieldMax, ShieldHP + MoteTuning::ShieldRegenPerSec * Dt);
	}

	// Soft push so fighters never stack inside each other.
	if (IsActiveInMatch() && State != EMoteFighterState::Respawning && GetWorld())
	{
		for (TActorIterator<AMoteCharacter> It(GetWorld()); It; ++It)
		{
			AMoteCharacter* Other = *It;
			if (Other == this || !Other->IsActiveInMatch() || Other->State == EMoteFighterState::Respawning)
			{
				continue;
			}
			FVector Delta = GetActorLocation() - Other->GetActorLocation();
			if (FMath::Abs(Delta.Z) > CapsuleHalfHeight * 1.6f)
			{
				continue;
			}
			Delta.Z = 0.f;
			const float Dist = Delta.Size();
			const float MinDist = CapsuleRadius * 1.7f;
			if (Dist < MinDist)
			{
				const FVector Push = (Dist > 1.f) ? Delta / Dist : FVector(0.f, PlayerIndex == 0 ? -1.f : 1.f, 0.f);
				AddActorWorldOffset(Push * (MinDist - Dist) * FMath::Min(1.f, Dt * 10.f), true);
			}
		}
	}

	TickPresentation(Dt, WorldDt);
}

void AMoteCharacter::TickTimers(float Dt)
{
	StateTime += Dt;
	BufferLight = FMath::Max(0.f, BufferLight - Dt);
	BufferHeavy = FMath::Max(0.f, BufferHeavy - Dt);
	BufferJump = FMath::Max(0.f, BufferJump - Dt);
	BufferDodge = FMath::Max(0.f, BufferDodge - Dt);
	InvulnTimer = FMath::Max(0.f, InvulnTimer - Dt);
	FlashTimer = FMath::Max(0.f, FlashTimer - Dt);
	TimeSinceHurt += Dt;
	TimeSinceJump += Dt;
	TimeSinceLanded += Dt;

	if (bControlsLocked)
	{
		BufferLight = BufferHeavy = BufferJump = BufferDodge = 0.f;
	}

	// A fighter who has been back on the deck, out of hitstun and untouched for
	// a moment has escaped: walking off the edge after that is their own doing,
	// not a KO for whoever last grazed them. Keyed on TimeSinceHurt rather than
	// TimeSinceLanded, because a flat grounded flinch never re-lands.
	if (LastAttacker.IsValid() && IsGrounded() && !IsInHitstun() && TimeSinceHurt > 1.5f)
	{
		LastAttacker.Reset();
	}

	// Combo counter: the chain breaks once the victim has been free for a moment.
	if (ComboVictim.IsValid())
	{
		const AMoteCharacter* V = ComboVictim.Get();
		if (!V->IsInHitstun() && V->GetTimeSinceHurt() > 0.35f)
		{
			ComboCount = 0;
			ComboVictim.Reset();
		}
	}

	const bool bGrounded = IsGrounded();
	if (bGrounded && !bWasGrounded)
	{
		TimeSinceLanded = 0.f;
	}
	bWasGrounded = bGrounded;
}

void AMoteCharacter::TickMovement(float Dt)
{
	UCharacterMovementComponent* Move = GetCharacterMovement();
	if (!Move || Move->MovementMode == MOVE_None || Move->MovementMode == MOVE_Flying)
	{
		return;
	}
	const FMoteFighterDef& Def = GetFighterDef();
	const bool bGrounded = Move->IsMovingOnGround();
	Move->MaxWalkSpeed = bGrounded ? Def.RunSpeed : Def.AirSpeed;

	FVector Input(MoveInput.X, MoveInput.Y, 0.f);
	if (bControlsLocked)
	{
		Input = FVector::ZeroVector;
	}

	bool bCanSteer = false;
	float Steer = 1.f;
	bool bCanTurn = false;
	switch (State)
	{
	case EMoteFighterState::Idle:
		bCanSteer = true;
		bCanTurn = true;
		break;
	case EMoteFighterState::Attacking:
		// Aerials keep a bit of drift; grounded moves are committed.
		bCanSteer = !bGrounded;
		Steer = 0.55f;
		break;
	case EMoteFighterState::Hitstun:
		// A little drift once the launch has mostly died down (DI-lite).
		bCanSteer = !bGrounded && HitstunTimer < 0.25f;
		Steer = 0.35f;
		break;
	default:
		break;
	}

	if (bCanSteer && !Input.IsNearlyZero())
	{
		AddMovementInput(Input, Steer);
	}

	if (bCanTurn && !Input.IsNearlyZero())
	{
		const float TargetYaw = static_cast<float>(Input.Rotation().Yaw);
		const float Rate = (bGrounded ? GroundTurnRate : AirTurnRate) * Dt;
		const float NewYaw = FMath::FixedTurn(static_cast<float>(GetActorRotation().Yaw), TargetYaw, Rate);
		SetActorRotation(FRotator(0.f, NewYaw, 0.f));
	}

	// Hover: hold jump while falling to float down slowly.
	bHovering = false;
	if (!bGrounded && bJumpHeld && State == EMoteFighterState::Idle && HoverLeft > 0.f
		&& Move->Velocity.Z < 0.f && TimeSinceJump > 0.18f)
	{
		bHovering = true;
		HoverLeft -= Dt;
		Move->Velocity.Z = FMath::Max(Move->Velocity.Z, -140.f);
	}
}

// ============================================================================
//  Jumping, landing, dodging, shield
// ============================================================================

void AMoteCharacter::DoJump(bool bAir)
{
	const FMoteFighterDef& Def = GetFighterDef();
	UCharacterMovementComponent* Move = GetCharacterMovement();

	FVector Vel = Move->Velocity;
	if (bAir)
	{
		++AirJumpsUsed;
		// Mid-air jumps redirect momentum toward the stick, like a platform fighter.
		Vel.X = MoveInput.X * Def.AirSpeed * 0.85f;
		Vel.Y = MoveInput.Y * Def.AirSpeed * 0.85f;
		Vel.Z = Def.AirJumpVelocity;
	}
	else
	{
		Vel.Z = Def.JumpVelocity;
	}
	Move->Velocity = Vel;
	Move->SetMovementMode(MOVE_Falling);
	TimeSinceJump = 0.f;

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->JumpPuff(GetActorLocation() - FVector(0.f, 0.f, CapsuleHalfHeight), GetAccent(), bAir);
	}
	PlaySfx(bAir ? TEXT("sfx_double_jump") : TEXT("sfx_jump"), bAir ? 0.7f : 0.55f);
}

void AMoteCharacter::Landed(const FHitResult& Hit)
{
	const FVector ImpactVel = GetCharacterMovement()->Velocity;
	Super::Landed(Hit);

	AirJumpsUsed = 0;
	bAirDodgeUsed = false;
	HoverLeft = GetFighterDef().HoverTime;
	TimeSinceLanded = 0.f;

	const FVector Foot = GetActorLocation() - FVector(0.f, 0.f, CapsuleHalfHeight);

	if (State == EMoteFighterState::Attacking)
	{
		const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
		if (M.bPlungeUntilLanding && Phase == EMoteMovePhase::Active)
		{
			ResolveLandingHit();
			EnterPhase(EMoteMovePhase::Recovery);
			return;
		}
		if (MoveSlot == EMoteMoveSlot::AirLight || MoveSlot == EMoteMoveSlot::AirHeavy)
		{
			EndMove();  // landing cancels the aerial
		}
	}

	if (State == EMoteFighterState::Dodging)
	{
		GetCharacterMovement()->GravityScale = GetFighterDef().GravityScale;
	}

	if (State == EMoteFighterState::Hitstun && bTumble && ImpactVel.Z < -1100.f)
	{
		// Ground bounce: pop back up, still tumbling. This MUST go through the
		// deferred launch: Landed() is called from ProcessLanded while the
		// component is still falling, so it calls SetPostLandedPhysics after
		// we return and projects any Velocity we wrote straight onto the floor.
		LaunchCharacter(FVector(ImpactVel.X * 0.55f, ImpactVel.Y * 0.55f, -ImpactVel.Z * 0.42f), true, true);
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			FX->Dust(Foot, 1.4f);
		}
		PlaySfx(TEXT("sfx_land"), 0.9f);
		if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
		{
			Hub->Impact(Foot, 0.5f);
		}
		return;
	}

	if (ImpactVel.Z < -700.f)
	{
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			FX->Dust(Foot, FMath::GetMappedRangeValueClamped(FVector2D(-700.f, -2400.f), FVector2D(0.5f, 1.2f), ImpactVel.Z));
		}
		PlaySfx(TEXT("sfx_land"), 0.45f);
	}
}

void AMoteCharacter::StartDodge(const FVector& Dir)
{
	const bool bGrounded = IsGrounded();
	Phase = EMoteMovePhase::None;
	DodgeDir = Dir.GetSafeNormal2D();
	UCharacterMovementComponent* Move = GetCharacterMovement();

	if (bGrounded)
	{
		if (DodgeDir.IsNearlyZero())
		{
			DodgeDir = -GetFacing();  // neutral roll backs away from trouble
		}
		DodgeDuration = RollDuration;
	}
	else
	{
		bAirDodgeUsed = true;
		DodgeDuration = AirDodgeDuration;
		Move->GravityScale = 0.f;
		// Directional air dodge doubles as a recovery tool: a little lift too.
		Move->Velocity = DodgeDir.IsNearlyZero() ? FVector::ZeroVector
			: DodgeDir * 1450.f + FVector(0.f, 0.f, 380.f);
	}
	DodgeTimer = 0.f;
	SetState(EMoteFighterState::Dodging);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->DashStreak(GetActorLocation(), DodgeDir.IsNearlyZero() ? GetFacing() : DodgeDir, GetAccent());
	}
	PlaySfx(TEXT("sfx_dodge"), 0.7f);
}

void AMoteCharacter::TickDodge(float Dt)
{
	DodgeTimer += Dt;
	const float Alpha = DodgeTimer / FMath::Max(DodgeDuration, 0.01f);
	UCharacterMovementComponent* Move = GetCharacterMovement();
	const bool bAir = Move->IsFalling();

	// Invulnerable through the middle of the dodge.
	if (Alpha > 0.08f && Alpha < 0.72f)
	{
		InvulnTimer = FMath::Max(InvulnTimer, 0.02f);
	}

	if (!bAir)
	{
		const float Speed = FMath::Lerp(1700.f, 150.f, FMath::Clamp(Alpha * 1.15f, 0.f, 1.f));
		Move->Velocity = FVector(DodgeDir.X * Speed, DodgeDir.Y * Speed, Move->Velocity.Z);
	}
	else
	{
		Move->Velocity *= FMath::Pow(0.06f, Dt);  // air dodge momentum bleeds off
	}

	if (DodgeTimer >= DodgeDuration)
	{
		Move->GravityScale = GetFighterDef().GravityScale;
		SetState(EMoteFighterState::Idle);
	}
}

void AMoteCharacter::TickShield(float Dt)
{
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->Velocity.X *= FMath::Pow(0.02f, Dt);
	Move->Velocity.Y *= FMath::Pow(0.02f, Dt);

	if (ShieldStunTimer > 0.f)
	{
		ShieldStunTimer -= Dt;
		return;  // locked in shield stun
	}

	ShieldHP -= MoteTuning::ShieldDrainPerSec * Dt;
	if (ShieldHP <= 0.f)
	{
		BreakShield();
		return;
	}

	if (!Move->IsMovingOnGround())
	{
		SetState(EMoteFighterState::Idle);
		return;
	}
	if (!bShieldHeld || bControlsLocked)
	{
		SetState(EMoteFighterState::Idle);
		return;
	}
	if (BufferDodge > 0.f)
	{
		BufferDodge = 0.f;
		StartDodge(FVector(BufferDodgeDir.X, BufferDodgeDir.Y, 0.f));
		return;
	}
	if (BufferJump > 0.f)
	{
		BufferJump = 0.f;
		SetState(EMoteFighterState::Idle);
		DoJump(false);
	}
}

void AMoteCharacter::BreakShield()
{
	ShieldHP = 0.f;
	SetState(EMoteFighterState::ShieldBroken);
	ShieldStunTimer = MoteTuning::ShieldBreakStun;
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->Velocity = FVector(0.f, 0.f, 950.f);
	Move->SetMovementMode(MOVE_Falling);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->ShieldBreak(GetActorLocation(), GetAccent());
	}
	PlaySfx(TEXT("sfx_shield_break"), 1.f, 0.f);
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->OnShieldBreak.Broadcast(this);
		Hub->Impact(GetActorLocation(), 0.8f);
	}
}

// ============================================================================
//  Moves
// ============================================================================

void AMoteCharacter::StartMove(EMoteMoveSlot Slot)
{
	const FMoteMoveDef& M = GetFighterDef().GetMove(Slot);
	if (!M.IsValid())
	{
		return;
	}

	MoveSlot = Slot;
	HitThisSwing.Reset();
	HitsDone = 0;
	ChargeTime = 0.f;
	bComboQueued = false;
	ComboIndex = (Slot == EMoteMoveSlot::Jab2) ? 1 : (Slot == EMoteMoveSlot::Jab3) ? 2 : 0;

	// Attacks aim: snap to the held direction on the first frame.
	if (!MoveInput.IsNearlyZero())
	{
		SetActorRotation(FRotator(0.f, FVector(MoveInput.X, MoveInput.Y, 0.f).Rotation().Yaw, 0.f));
	}
	MoveFacing = GetFacing();

	SetState(EMoteFighterState::Attacking);
	const bool bCharge = M.bChargeable && bHeavyHeld;
	EnterPhase(bCharge ? EMoteMovePhase::Charging : EMoteMovePhase::Startup);

	if (bCharge)
	{
		PlaySfx(TEXT("sfx_charge_loop"), 0.35f, 0.f);
	}
}

void AMoteCharacter::EnterPhase(EMoteMovePhase NewPhase)
{
	Phase = NewPhase;
	PhaseTime = 0.f;
	if (Phase == EMoteMovePhase::Active)
	{
		OnMoveActive();
	}
}

float AMoteCharacter::CurrentChargeScale() const
{
	const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
	if (!M.bChargeable)
	{
		return 1.f;
	}
	const float C = FMath::Clamp(ChargeTime / FMath::Max(M.MaxCharge, 0.01f), 0.f, 1.f);
	return FMath::Lerp(1.f, M.ChargeBonus, C);
}

void AMoteCharacter::OnMoveActive()
{
	const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
	const float ChargeScale = CurrentChargeScale();
	UCharacterMovementComponent* Move = GetCharacterMovement();

	PlaySfx(M.SwingSound, 0.8f);

	// Self motion.
	if (M.LungeSpeed > 0.f && M.LungeSpeed < 1000.f)
	{
		Move->Velocity += MoveFacing * M.LungeSpeed;
	}
	if (M.VerticalSpeed > 0.f)
	{
		Move->Velocity.Z = M.VerticalSpeed;
		Move->SetMovementMode(MOVE_Falling);
	}
	else if (M.VerticalSpeed < 0.f)
	{
		Move->Velocity = MoveFacing * 180.f + FVector(0.f, 0.f, M.VerticalSpeed);
	}

	// A big readable swoosh for sweeping melee moves.
	if (M.Shape == EMoteHitShape::Arc || M.Shape == EMoteHitShape::Radial)
	{
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			const bool bRightToLeft = (M.Anim != EMoteMoveAnim::SlashLeft);
			const float Arc = (M.Shape == EMoteHitShape::Radial) ? 360.f : M.ArcDegrees;
			const float R = (M.Shape == EMoteHitShape::Radial) ? M.Radius : M.Reach;
			FX->SlashArc(GetActorLocation() + FVector(0.f, 0.f, M.HeightOffset + 10.f), MoveFacing.Rotation(),
				R, Arc, GetAccent(), bRightToLeft, FMath::Clamp(M.Damage / 10.f, 0.3f, 1.5f) * ChargeScale);
		}
	}

	if (M.Projectile != EMoteProjectileKind::None)
	{
		EmitProjectiles(ChargeScale);
	}

	if (M.Anim == EMoteMoveAnim::GroundSlam)
	{
		const FVector Foot = GetActorLocation() + MoveFacing * 90.f - FVector(0.f, 0.f, CapsuleHalfHeight);
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			FX->Shockwave(Foot, M.Radius * 1.1f, GetAccent(), 1.2f * ChargeScale);
			FX->Dust(Foot, 1.6f);
		}
		if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
		{
			Hub->Impact(Foot, 1.0f * ChargeScale);
		}
	}
}

void AMoteCharacter::TickAttack(float Dt)
{
	const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
	UCharacterMovementComponent* Move = GetCharacterMovement();
	PhaseTime += Dt;

	// Buffer the next jab while this one plays out.
	if (BufferLight > 0.f && (MoveSlot == EMoteMoveSlot::Jab1 || MoveSlot == EMoteMoveSlot::Jab2))
	{
		BufferLight = 0.f;
		bComboQueued = true;
	}

	switch (Phase)
	{
	case EMoteMovePhase::Charging:
	{
		const float Before = ChargeTime;
		ChargeTime = FMath::Min(ChargeTime + Dt, M.MaxCharge);
		SmokeTimer -= Dt;
		if (SmokeTimer <= 0.f)
		{
			SmokeTimer = 0.07f;
			if (UMoteFX* FX = UMoteFX::Get(this))
			{
				FX->ChargeSparkle(GetCoreLocation(), GetAccent(), ChargeTime / FMath::Max(M.MaxCharge, 0.01f));
			}
		}
		if (ChargeTime >= M.MaxCharge && Before < M.MaxCharge)
		{
			if (UMoteFX* FX = UMoteFX::Get(this))
			{
				FX->ChargeReady(GetCoreLocation(), GetAccent());
			}
			PlaySfx(TEXT("sfx_charge_ready"), 0.8f, 0.f);
		}
		// Release, or auto-release after holding a full charge for a beat.
		if (!bHeavyHeld || PhaseTime >= M.MaxCharge + 0.35f)
		{
			EnterPhase(EMoteMovePhase::Startup);
		}
		break;
	}

	case EMoteMovePhase::Startup:
		if (PhaseTime >= M.Startup)
		{
			EnterPhase(EMoteMovePhase::Active);
		}
		break;

	case EMoteMovePhase::Active:
	{
		const float Scale = CurrentChargeScale();

		// Sustained dashes carry the fighter through the whole active window.
		if (M.LungeSpeed >= 1000.f)
		{
			const float ChargeT = (Scale - 1.f) / FMath::Max(M.ChargeBonus - 1.f, 0.01f);
			const float Speed = M.LungeSpeed * FMath::Lerp(1.f, 1.25f, ChargeT)
				* FMath::Lerp(1.f, 0.55f, PhaseTime / FMath::Max(M.Active, 0.01f));
			Move->Velocity = FVector(MoveFacing.X * Speed, MoveFacing.Y * Speed, Move->Velocity.Z);
			SmokeTimer -= Dt;
			if (SmokeTimer <= 0.f)
			{
				SmokeTimer = 0.05f;
				if (UMoteFX* FX = UMoteFX::Get(this))
				{
					FX->DashStreak(GetActorLocation(), MoveFacing, GetAccent());
					if (M.Fx == EMoteFxType::Fire)
					{
						FX->FireBurst(GetActorLocation() - MoveFacing * 40.f, -MoveFacing, 0.6f);
					}
				}
			}
		}

		if (M.bReflects)
		{
			ReflectProjectiles();
		}

		if (M.Shape != EMoteHitShape::None)
		{
			const int32 Hits = FMath::Max(1, M.Hits);
			const float Interval = M.Active / Hits;
			while (HitsDone < Hits && PhaseTime >= Interval * HitsDone)
			{
				const bool bFinal = (HitsDone == Hits - 1);
				HitThisSwing.Reset();
				ResolveHitbox(Scale, bFinal, HitsDone);
				++HitsDone;
				if (HitsDone < Hits && Hits > 1)
				{
					PlaySfx(M.SwingSound, 0.45f, 0.1f);
				}
				if (State != EMoteFighterState::Attacking)
				{
					return;
				}
			}
			// Plunges keep their hitbox live the whole way down.
			if (M.bPlungeUntilLanding)
			{
				ResolveHitbox(Scale, true, 0);
			}
		}

		if (M.bPlungeUntilLanding)
		{
			if (PhaseTime > 1.6f)
			{
				EnterPhase(EMoteMovePhase::Recovery);
			}
		}
		else if (PhaseTime >= M.Active)
		{
			EnterPhase(EMoteMovePhase::Recovery);
		}
		break;
	}

	case EMoteMovePhase::Recovery:
	{
		// Jab cancel window: the queued next hit starts partway through recovery.
		if (bComboQueued && PhaseTime >= M.Recovery * 0.3f)
		{
			const EMoteMoveSlot Next = (MoveSlot == EMoteMoveSlot::Jab1) ? EMoteMoveSlot::Jab2 : EMoteMoveSlot::Jab3;
			StartMove(Next);
			return;
		}
		if (PhaseTime >= M.Recovery)
		{
			EndMove();
		}
		break;
	}

	default:
		EndMove();
		break;
	}
}

void AMoteCharacter::EndMove()
{
	Phase = EMoteMovePhase::None;
	bComboQueued = false;
	if (State == EMoteFighterState::Attacking)
	{
		SetState(EMoteFighterState::Idle);
	}
}

void AMoteCharacter::ResolveHitbox(float DamageScale, bool bFinalHit, int32 HitIndex)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
	const FVector Origin = GetActorLocation();
	const FVector Fwd = MoveFacing;

	for (TActorIterator<AMoteCharacter> It(World); It; ++It)
	{
		AMoteCharacter* Target = *It;
		if (!Target || Target == this || !Target->IsActiveInMatch() || HitThisSwing.Contains(Target))
		{
			continue;
		}
		const FVector TLoc = Target->GetActorLocation();
		const float TR = CapsuleRadius;
		bool bInside = false;
		FVector HitCenter = TLoc;

		switch (M.Shape)
		{
		case EMoteHitShape::Arc:
		{
			const FVector Delta = TLoc - Origin;
			const float Horizontal = Delta.Size2D();
			const bool bVertical = FMath::Abs(Delta.Z - M.HeightOffset) <= M.Radius + CapsuleHalfHeight;
			bool bAngle = true;
			if (Horizontal > 70.f)
			{
				const float CosA = FVector::DotProduct(Fwd, Delta.GetSafeNormal2D());
				bAngle = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(CosA, -1.f, 1.f))) <= M.ArcDegrees * 0.5f;
			}
			bInside = bVertical && bAngle && Horizontal <= M.Reach + TR;
			HitCenter = Origin + Delta.GetSafeNormal2D() * FMath::Min(Horizontal, M.Reach * 0.8f);
			break;
		}
		case EMoteHitShape::Sphere:
		{
			const FVector C = Origin + Fwd * M.Reach + FVector(0.f, 0.f, M.HeightOffset);
			bInside = FVector::Dist(C, TLoc) <= M.Radius + TR + 20.f;
			HitCenter = C;
			break;
		}
		case EMoteHitShape::Radial:
		{
			const FVector Delta = TLoc - Origin;
			bInside = Delta.Size2D() <= M.Radius + TR && FMath::Abs(Delta.Z) <= M.Radius * 0.7f + CapsuleHalfHeight;
			HitCenter = Origin + Delta.GetSafeNormal2D() * FMath::Min(Delta.Size2D(), M.Radius * 0.8f);
			break;
		}
		case EMoteHitShape::Thrust:
		{
			const FVector A = Origin + FVector(0.f, 0.f, M.HeightOffset);
			const FVector B = A + Fwd * M.Reach;
			bInside = DistToSegment(TLoc, A, B) <= M.Radius + TR;
			HitCenter = (A + B) * 0.5f;
			break;
		}
		default:
			break;
		}

		if (!bInside)
		{
			continue;
		}
		HitThisSwing.Add(Target);

		FMoteHitInfo Hit;
		Hit.Attacker = this;
		Hit.Fx = M.Fx;
		Hit.HitstopScale = M.HitstopScale;
		Hit.ShakeScale = M.ShakeScale;
		Hit.Location = FMath::Lerp(HitCenter, TLoc, 0.6f) + FVector(0.f, 0.f, 20.f);
		Hit.Damage = M.Damage * DamageScale;

		const FVector Away = (TLoc - Origin).GetSafeNormal2D();
		const bool bSweep = (M.Shape == EMoteHitShape::Arc || M.Shape == EMoteHitShape::Radial);
		Hit.Direction = bSweep ? (Away.IsNearlyZero() ? Fwd : Away) : (Fwd * 0.65f + Away * 0.35f).GetSafeNormal2D();

		if (!bFinalHit && M.Hits > 1)
		{
			// Link hits: small fixed knockback that holds the victim in the flurry.
			Hit.FixedKnockback = 22.f;
			Hit.LaunchAngle = 15.f;
			Hit.Direction = (HitCenter - TLoc).GetSafeNormal2D();
			if (Hit.Direction.IsNearlyZero()) { Hit.Direction = Fwd; }
			Hit.HitstopScale = 0.6f;
			Hit.ShakeScale = 0.4f;
		}
		else
		{
			Hit.BaseKnockback = M.BaseKnockback * FMath::Lerp(1.f, DamageScale, 0.5f);
			Hit.KnockbackGrowth = M.KnockbackGrowth;
			Hit.LaunchAngle = M.LaunchAngle;
			// Spikes only spike in the air; grounded targets get popped up instead.
			if (Hit.LaunchAngle < 0.f && Target->IsGrounded())
			{
				Hit.LaunchAngle = 35.f;
			}
		}

		Target->TakeHit(Hit);
		if (State != EMoteFighterState::Attacking)
		{
			return;
		}
	}
	(void)HitIndex;
}

void AMoteCharacter::ResolveLandingHit()
{
	const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
	const FVector Foot = GetActorLocation() - FVector(0.f, 0.f, CapsuleHalfHeight);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->Shockwave(Foot, M.LandingRadius * 1.15f, GetAccent(), 1.2f);
		FX->Dust(Foot, 1.5f);
	}
	PlaySfx(TEXT("sfx_slam"), 0.9f);
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->Impact(Foot, 0.9f);
	}

	for (TActorIterator<AMoteCharacter> It(GetWorld()); It; ++It)
	{
		AMoteCharacter* Target = *It;
		if (!Target || Target == this || !Target->IsActiveInMatch() || HitThisSwing.Contains(Target))
		{
			continue;
		}
		const FVector Delta = Target->GetActorLocation() - GetActorLocation();
		if (Delta.Size2D() > M.LandingRadius + CapsuleRadius || FMath::Abs(Delta.Z) > 220.f)
		{
			continue;
		}
		HitThisSwing.Add(Target);
		FMoteHitInfo Hit;
		Hit.Attacker = this;
		Hit.Damage = M.Damage * 0.85f;
		Hit.BaseKnockback = M.BaseKnockback + 10.f;
		Hit.KnockbackGrowth = M.KnockbackGrowth;
		Hit.LaunchAngle = 55.f;
		Hit.Direction = Delta.GetSafeNormal2D().IsNearlyZero() ? MoveFacing : Delta.GetSafeNormal2D();
		Hit.Location = Target->GetActorLocation();
		Hit.Fx = M.Fx;
		Hit.HitstopScale = M.HitstopScale;
		Hit.ShakeScale = M.ShakeScale;
		Target->TakeHit(Hit);
	}
}

void AMoteCharacter::EmitProjectiles(float ChargeScale)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	const FMoteFighterDef& Def = GetFighterDef();
	const FMoteMoveDef& M = Def.GetMove(MoveSlot);
	const float Charge01 = M.bChargeable ? FMath::Clamp(ChargeTime / FMath::Max(M.MaxCharge, 0.01f), 0.f, 1.f) : 0.f;

	FActorSpawnParameters Params;
	Params.Owner = this;
	Params.Instigator = this;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	if (M.Projectile == EMoteProjectileKind::Lightning)
	{
		// Strike a spot in front; charging reaches further.
		FVector Spot = GetActorLocation() + MoveFacing * (M.Reach + 360.f * Charge01);
		Spot.Z = GetActorLocation().Z - CapsuleHalfHeight;
		if (const AMoteGameMode* GM = World->GetAuthGameMode<AMoteGameMode>())
		{
			if (GM->GetArena() && GM->GetArena()->IsOverPlatform(Spot))
			{
				Spot.Z = 0.f;
			}
		}
		if (AMoteProjectile* Strike = World->SpawnActor<AMoteProjectile>(AMoteProjectile::StaticClass(), Spot, FRotator::ZeroRotator, Params))
		{
			Strike->Launch(this, M, FVector::UpVector, 0.f, ChargeScale, nullptr, 0.f, GetAccent());
		}
		return;
	}

	// Pick the projectile's mesh and size.
	UStaticMesh* ProjMesh = nullptr;
	float MeshSize = 60.f;
	switch (M.Projectile)
	{
	case EMoteProjectileKind::Arrow:
		ProjMesh = Def.ProjectileMesh.IsEmpty() ? nullptr : LoadObject<UStaticMesh>(nullptr, *Def.ProjectileMesh, nullptr, LOAD_Quiet | LOAD_NoWarn);
		MeshSize = 115.f;
		break;
	case EMoteProjectileKind::Disc:
		ProjMesh = WeaponMesh ? WeaponMesh->GetStaticMesh() : nullptr;
		MeshSize = Def.Mount.Length;
		break;
	case EMoteProjectileKind::Bomb:
		ProjMesh = WeaponMesh ? WeaponMesh->GetStaticMesh() : nullptr;
		MeshSize = Def.Mount.Length * 1.1f;
		break;
	default:
		MeshSize = 55.f;
		break;
	}

	const int32 Count = FMath::Max(1, M.ProjectileCount);
	const FVector Muzzle = GetActorLocation() + MoveFacing * 80.f + FVector(0.f, 0.f, 15.f);
	const float Speed = M.ProjectileSpeed * FMath::Lerp(1.f, 1.55f, Charge01);

	for (int32 i = 0; i < Count; ++i)
	{
		float Yaw = 0.f;
		if (Count > 1)
		{
			Yaw = -M.ProjectileSpread * 0.5f + M.ProjectileSpread * i / (Count - 1);
		}
		const FRotator Aim(M.ProjectilePitch, MoveFacing.Rotation().Yaw + Yaw, 0.f);
		const FVector Dir = Aim.Vector();

		if (AMoteProjectile* Shot = World->SpawnActor<AMoteProjectile>(AMoteProjectile::StaticClass(), Muzzle, Aim, Params))
		{
			Shot->Launch(this, M, Dir, Speed, ChargeScale, ProjMesh, MeshSize, GetAccent());
		}
	}
}

void AMoteCharacter::ReflectProjectiles()
{
	for (TActorIterator<AMoteProjectile> It(GetWorld()); It; ++It)
	{
		AMoteProjectile* Shot = *It;
		if (!Shot || Shot->GetOwnerMote() == this || !Shot->IsReflectable())
		{
			continue;
		}
		if (FVector::DistSquared(Shot->GetActorLocation(), GetActorLocation()) < FMath::Square(230.f))
		{
			Shot->Reflect(this);
			if (UMoteFX* FX = UMoteFX::Get(this))
			{
				FX->Reflect(Shot->GetActorLocation(), GetAccent());
			}
			PlaySfx(TEXT("sfx_reflect"), 0.9f);
		}
	}
}

// ============================================================================
//  Taking hits
// ============================================================================

float AMoteCharacter::ComputeKnockback(const FMoteHitInfo& Hit, float PercentAfter) const
{
	if (Hit.FixedKnockback > 0.f)
	{
		return Hit.FixedKnockback;
	}
	// Super Smash Bros. knockback formula.
	const float P = PercentAfter;
	const float D = Hit.Damage;
	const float W = GetFighterDef().Weight;
	const float S = Hit.KnockbackGrowth / 100.f;
	const float KB = ((((P / 10.f + P * D / 20.f) * (200.f / (W + 100.f)) * 1.4f) + 18.f) * S) + Hit.BaseKnockback;
	return FMath::Min(KB, 420.f);
}

void AMoteCharacter::ApplyHitstop(float Seconds, bool bAsVictim)
{
	HitstopTimer = FMath::Max(HitstopTimer, Seconds);
	bHitstopVictim = bAsVictim;
	CustomTimeDilation = 0.0001f;
}

void AMoteCharacter::NotifyLandedHit(AMoteCharacter* Victim, float Damage)
{
	StatDamageDealt += Damage;
	if (Victim)
	{
		if (ComboVictim.Get() == Victim && (Victim->IsInHitstun() || Victim->GetTimeSinceHurt() < 0.35f))
		{
			++ComboCount;
		}
		else
		{
			ComboVictim = Victim;
			ComboCount = 1;
		}
		StatMaxCombo = FMath::Max(StatMaxCombo, static_cast<float>(ComboCount));
	}
}

EMoteHitResult AMoteCharacter::TakeHit(const FMoteHitInfo& Hit)
{
	if (!IsActiveInMatch() || IsInvulnerable() || State == EMoteFighterState::Victory)
	{
		return EMoteHitResult::Ignored;
	}

	AMoteCharacter* Attacker = Hit.Attacker;
	UMoteFX* FX = UMoteFX::Get(this);
	UMoteEventHub* Hub = UMoteEventHub::Get(this);
	const FLinearColor AttackerColor = Attacker ? Attacker->GetAccent() : FLinearColor::White;

	// ---- shield ----
	if (State == EMoteFighterState::Shielding)
	{
		ShieldHP -= Hit.Damage * 1.25f + 2.f;
		ShieldStunTimer = FMath::Clamp(Hit.Damage * 0.018f + 0.05f, 0.06f, 0.35f);
		const FVector Push = Hit.Direction.GetSafeNormal2D() * FMath::Clamp(Hit.Damage * 45.f, 150.f, 700.f);
		GetCharacterMovement()->Velocity += Push;
		if (FX) { FX->BlockSpark(Hit.Location, GetAccent()); }
		PlaySfx(TEXT("sfx_shield_block"), 0.9f);

		const float Stop = (Hit.Damage * 0.3f + 3.f) / 60.f;
		ApplyHitstop(Stop, true);
		if (Attacker && !Hit.bRanged) { Attacker->ApplyHitstop(Stop, false); }

		if (Hub)
		{
			FMoteHitEvent E;
			E.Attacker = Attacker;
			E.Victim = this;
			E.Damage = Hit.Damage;
			E.Location = Hit.Location;
			E.Fx = Hit.Fx;
			E.bBlocked = true;
			Hub->OnHit.Broadcast(E);
		}
		if (ShieldHP <= 0.f)
		{
			BreakShield();
		}
		return EMoteHitResult::Blocked;
	}

	// ---- damage & launch ----
	Percent = FMath::Min(999.f, Percent + Hit.Damage);
	const float KB = ComputeKnockback(Hit, Percent);

	const bool bGrounded = IsGrounded();
	FVector Dir = Hit.Direction.GetSafeNormal2D();
	if (Dir.IsNearlyZero())
	{
		Dir = -GetFacing();
	}
	const float Speed = KB * MoteTuning::LaunchSpeedPerKB;
	const float Rad = FMath::DegreesToRadians(Hit.LaunchAngle);
	FVector Vel = Dir * FMath::Cos(Rad) * Speed + FVector(0.f, 0.f, FMath::Sin(Rad) * Speed);

	const bool bStrong = KB >= MoteTuning::TumbleThreshold;
	bool bFlatFlinch = false;
	if (!bStrong && bGrounded && Vel.Z < 450.f)
	{
		Vel.Z = 0.f;  // flinches stay on the ground
		Vel *= 0.8f;
		bFlatFlinch = true;
	}

	// Cancel whatever we were doing.
	Phase = EMoteMovePhase::None;
	bComboQueued = false;
	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->GravityScale = GetFighterDef().GravityScale;
	if (Move->MovementMode == MOVE_Flying)
	{
		Move->SetMovementMode(MOVE_Falling);
	}
	SetState(EMoteFighterState::Hitstun);
	HitstunTimer = FMath::Max(bStrong ? 0.3f : 0.14f, KB * MoteTuning::HitstunPerKB);
	bTumble = bStrong;
	LaunchVel = Vel;
	if (bFlatFlinch)
	{
		// LaunchCharacter always switches to MOVE_Falling, even for a purely
		// horizontal shove. Through hitstop that left the victim "airborne"
		// for the whole freeze, so every jab ended in a landing squash and the
		// next hit treated a standing fighter as airborne.
		Move->Velocity = FVector(Vel.X, Vel.Y, Move->Velocity.Z);
	}
	else
	{
		LaunchCharacter(Vel, true, true);
	}

	// Reel away from the attacker.
	SetActorRotation(FRotator(0.f, (-Dir).Rotation().Yaw, 0.f));

	FlashTimer = 0.2f;
	TimeSinceHurt = 0.f;
	LastAttacker = Attacker;
	if (Attacker)
	{
		Attacker->NotifyLandedHit(this, Hit.Damage);
	}

	const bool bLethal = bStrong && PredictLethal(GetActorLocation(), Vel);

	// Hitstop: longer for bigger hits, extra-long for the killing blow.
	float Stop = (Hit.Damage * 0.42f + 4.f) / 60.f * Hit.HitstopScale;
	if (bLethal) { Stop *= 1.8f; }
	Stop = FMath::Clamp(Stop, 0.05f, 0.45f);
	ApplyHitstop(Stop, true);
	if (Attacker && !Hit.bRanged)
	{
		Attacker->ApplyHitstop(Stop, false);
	}

	// ---- presentation ----
	const float Strength = FMath::Clamp(KB / 110.f, 0.25f, 2.f) * Hit.ShakeScale;
	if (FX)
	{
		FX->HitSpark(Hit.Location, Vel.GetSafeNormal(), Hit.Fx, AttackerColor, Strength);
	}

	FName HitSound = TEXT("sfx_hit_light");
	if (KB >= 130.f) { HitSound = TEXT("sfx_hit_heavy"); }
	else if (KB >= 60.f) { HitSound = TEXT("sfx_hit_medium"); }
	PlaySfx(HitSound, 0.9f);
	switch (Hit.Fx)
	{
	case EMoteFxType::Slash:    PlaySfx(TEXT("sfx_hit_slash"), 0.6f); break;
	case EMoteFxType::Blunt:    PlaySfx(TEXT("sfx_hit_blunt"), 0.7f); break;
	case EMoteFxType::Electric: PlaySfx(TEXT("sfx_lightning"), 0.45f); break;
	case EMoteFxType::Fire:     PlaySfx(TEXT("sfx_fire_whoosh"), 0.45f); break;
	default: break;
	}
	if (KB >= 150.f)
	{
		PlaySfx(TEXT("sfx_launch"), 0.8f);
	}
	if (bLethal)
	{
		PlaySfx(TEXT("sfx_final_hit"), 1.f, 0.f);
	}

	if (Hub)
	{
		FMoteHitEvent E;
		E.Attacker = Attacker;
		E.Victim = this;
		E.Damage = Hit.Damage;
		E.Knockback = KB;
		E.Location = Hit.Location;
		E.LaunchVelocity = Vel;
		E.Fx = Hit.Fx;
		E.bStrong = bStrong;
		E.bLethal = bLethal;
		Hub->OnHit.Broadcast(E);
	}
	return EMoteHitResult::Hit;
}

void AMoteCharacter::TickHitstun(float Dt)
{
	HitstunTimer -= Dt;
	UCharacterMovementComponent* Move = GetCharacterMovement();

	if (bTumble && Move->IsFalling())
	{
		// Launch speed bleeds off horizontally (Smash's knockback decay).
		const FVector H(Move->Velocity.X, Move->Velocity.Y, 0.f);
		const float Size = H.Size();
		if (Size > 1.f)
		{
			const float NewSize = FMath::Max(0.f, Size - MoteTuning::LaunchDrag * Dt);
			Move->Velocity.X = H.X / Size * NewSize;
			Move->Velocity.Y = H.Y / Size * NewSize;
		}
	}

	const float Speed = Move->Velocity.Size();
	if (Speed > 1300.f)
	{
		SmokeTimer -= Dt;
		if (SmokeTimer <= 0.f)
		{
			SmokeTimer = 0.035f;
			if (UMoteFX* FX = UMoteFX::Get(this))
			{
				FX->LaunchSmoke(GetActorLocation(), Move->Velocity, FMath::Clamp(Speed / 2600.f, 0.3f, 1.6f));
			}
		}
	}

	if (HitstunTimer <= 0.f)
	{
		HitstunTimer = 0.f;
		SetState(EMoteFighterState::Idle);
	}
}

bool AMoteCharacter::PredictLethal(const FVector& StartLocation, const FVector& Velocity) const
{
	const AMoteGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
	const AMoteArena* Arena = GM ? GM->GetArena() : nullptr;
	if (!Arena)
	{
		return false;
	}
	const float Gravity = FMath::Abs(GetWorld()->GetGravityZ()) * GetFighterDef().GravityScale;
	FVector P = StartLocation;
	FVector V = Velocity;
	const float Step = 1.f / 30.f;
	for (int32 i = 0; i < 150; ++i)
	{
		const FVector H(V.X, V.Y, 0.f);
		const float Size = H.Size();
		if (Size > 1.f)
		{
			const float NewSize = FMath::Max(0.f, Size - MoteTuning::LaunchDrag * Step);
			V.X = H.X / Size * NewSize;
			V.Y = H.Y / Size * NewSize;
		}
		V.Z -= Gravity * Step;
		P += V * Step;
		if (Arena->IsOutsideBlastZone(P))
		{
			return true;
		}
		// Lands back on the stage: survives.
		if (V.Z < 0.f && P.Z <= CapsuleHalfHeight && Arena->IsOverPlatform(P))
		{
			return false;
		}
		// The launch has died near the stage: they can recover.
		if (V.SizeSquared2D() < FMath::Square(400.f) && V.Z > -600.f && P.Z > Arena->GetBlastBottom() + 1200.f
			&& FVector(P.X, P.Y, 0.f).Size() < Arena->GetBlastSideRadius() - 900.f)
		{
			return false;
		}
	}
	return false;
}

// ============================================================================
//  Presentation
// ============================================================================

void AMoteCharacter::TickPresentation(float Dt, float RealDt)
{
	if (Animator)
	{
		Animator->UpdatePose(GetAnimState(), RealDt);
	}

	if (Trail && Animator)
	{
		if (Animator->WantsTrail() && State == EMoteFighterState::Attacking)
		{
			FVector Base, Tip;
			Animator->GetTrailSegment(Base, Tip);
			Trail->SetEmitting(true);
			Trail->AddSample(Base, Tip);
		}
		else
		{
			Trail->SetEmitting(false);
		}
	}

	// Shield bubble.
	const bool bShowShield = (State == EMoteFighterState::Shielding);
	if (ShieldBubble)
	{
		ShieldBubble->SetVisibility(bShowShield);
		if (bShowShield)
		{
			const FMoteFighterDef& Def = GetFighterDef();
			const float S = FMath::Lerp(0.6f, 1.0f, GetShield01()) * Def.BodyHeight * 1.5f / 100.f;
			ShieldBubble->SetRelativeScale3D(FVector(S));
			ShieldBubble->SetRelativeLocation(FVector(0.f, 0.f, -5.f));
			if (ShieldMID)
			{
				const float Pulse = 0.5f + 0.5f * FMath::Sin(WorldTime * 9.f);
				ShieldMID->SetVectorParameterValue(TEXT("Color"), FMath::Lerp(FLinearColor(1.f, 0.2f, 0.15f), Def.Accent, GetShield01()));
				ShieldMID->SetScalarParameterValue(TEXT("Opacity"), 0.18f + 0.12f * Pulse * (1.f - GetShield01()));
				ShieldMID->SetScalarParameterValue(TEXT("Intensity"), 0.9f);
			}
		}
	}

	// Core light breathes, flares while charging.
	if (CoreLight)
	{
		float Glow = 5.f + 1.6f * FMath::Sin(WorldTime * 3.f);
		if (IsCharging())
		{
			const FMoteMoveDef& M = GetFighterDef().GetMove(MoveSlot);
			Glow += 26.f * FMath::Clamp(ChargeTime / FMath::Max(M.MaxCharge, 0.01f), 0.f, 1.f);
		}
		CoreLight->SetIntensity(Glow);
	}

	// Disc: hide the held chakram while a returning throw is out.
	if (WeaponMesh && Core == EMoteCore::Disc)
	{
		bool bDiscOut = false;
		for (TActorIterator<AMoteProjectile> It(GetWorld()); It; ++It)
		{
			if (It->GetOwnerMote() == this && It->IsReturningWeapon())
			{
				bDiscOut = true;
				break;
			}
		}
		WeaponMesh->SetHiddenInGame(bDiscOut);
	}

	UpdateOverlay(RealDt);
	(void)Dt;
}

void AMoteCharacter::UpdateOverlay(float RealDt)
{
	if (!OverlayMID)
	{
		return;
	}
	const FMoteFighterDef& Def = GetFighterDef();

	FLinearColor FlashColor = FLinearColor::White;
	float Flash = 0.f;
	FLinearColor RimColor = Def.Accent;
	float Rim = 0.25f;

	if (FlashTimer > 0.f)
	{
		// Bright white pop that cools to red.
		const float A = FlashTimer / 0.2f;
		FlashColor = FMath::Lerp(FLinearColor(1.f, 0.12f, 0.1f), FLinearColor(1.f, 1.f, 1.f), A);
		Flash = 0.35f + 0.55f * A;
	}
	else if (State == EMoteFighterState::ShieldBroken)
	{
		FlashColor = FLinearColor(1.f, 0.85f, 0.2f);
		Flash = 0.25f + 0.2f * FMath::Sin(WorldTime * 14.f);
	}

	if (IsCharging())
	{
		const FMoteMoveDef& M = Def.GetMove(MoveSlot);
		const float C = FMath::Clamp(ChargeTime / FMath::Max(M.MaxCharge, 0.01f), 0.f, 1.f);
		Rim = 0.4f + 1.4f * C * (0.75f + 0.25f * FMath::Sin(WorldTime * 30.f));
	}
	if (IsInvulnerable() && State != EMoteFighterState::Dodging)
	{
		RimColor = FLinearColor::White;
		Rim = 0.6f + 0.5f * FMath::Sin(WorldTime * 18.f);
	}

	OverlayMID->SetVectorParameterValue(TEXT("FlashColor"), FlashColor);
	OverlayMID->SetScalarParameterValue(TEXT("FlashAmount"), Flash);
	OverlayMID->SetVectorParameterValue(TEXT("RimColor"), RimColor);
	OverlayMID->SetScalarParameterValue(TEXT("RimAmount"), Rim);
	(void)RealDt;
}

void AMoteCharacter::PlaySfx(FName Sound, float Volume, float PitchJitter) const
{
	if (Sound.IsNone())
	{
		return;
	}
	if (UMoteAudio* Audio = UMoteAudio::Get(this))
	{
		Audio->Play(Sound, Volume, 1.f, PitchJitter);
	}
}
