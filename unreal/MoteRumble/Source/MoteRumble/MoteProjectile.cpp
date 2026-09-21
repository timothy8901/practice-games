// Copyright Not Tim Games. All Rights Reserved.

#include "MoteProjectile.h"

#include "MoteArena.h"
#include "MoteAudio.h"
#include "MoteCharacter.h"
#include "MoteEvents.h"
#include "MoteFX.h"
#include "MoteGameMode.h"

#include "Components/PointLightComponent.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const TCHAR* SphereMeshPath = TEXT("/Engine/BasicShapes/Sphere.Sphere");
	const TCHAR* BasicMaterialPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");
	const TCHAR* AdditivePath = TEXT("/Game/FX/M_FX_Additive.M_FX_Additive");
	constexpr float HitRadius = 58.f;
	constexpr float FighterRadius = 46.f;
	constexpr float LightningDelay = 0.5f;
	constexpr float BombGravity = 2400.f;
}

AMoteProjectile::AMoteProjectile()
{
	PrimaryActorTick.bCanEverTick = true;

	Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
	Collision->InitSphereRadius(HitRadius);
	Collision->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	RootComponent = Collision;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(Collision);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetCastShadow(true);

	Glow = CreateDefaultSubobject<UPointLightComponent>(TEXT("Glow"));
	Glow->SetupAttachment(Collision);
	Glow->SetCastShadows(false);
	Glow->SetIntensityUnits(ELightUnits::Candelas);
	Glow->SetIntensity(30.f);
	Glow->SetAttenuationRadius(380.f);

	InitialLifeSpan = 6.f;
}

void AMoteProjectile::Launch(AMoteCharacter* InOwner, const FMoteMoveDef& InMove, const FVector& Direction,
	float Speed, float InChargeScale, UStaticMesh* InMesh, float MeshSize, const FLinearColor& InColor)
{
	OwnerMote = InOwner;
	Thrower = InOwner;
	Move = InMove;
	Kind = InMove.Projectile;
	Color = InColor;
	ChargeScale = InChargeScale;
	Life = FMath::Max(0.2f, InMove.ProjectileLife);
	Velocity = Direction.GetSafeNormal() * Speed;
	Glow->SetLightColor(Color);

	if (Kind == EMoteProjectileKind::Lightning)
	{
		Mesh->SetVisibility(false);
		Glow->SetIntensity(0.f);
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			FX->LightningWarning(GetActorLocation(), Move.ExplosionRadius, LightningDelay, Color);
		}
		return;
	}

	if (InMesh)
	{
		Mesh->SetStaticMesh(InMesh);
		const FBox Box = InMesh->GetBoundingBox();
		const FVector Size = Box.GetSize();
		const float Scale = MeshSize / FMath::Max(Size.GetMax(), 1.f);

		// Point the long axis along +X (arrows), then centre it.
		FRotator Align = FRotator::ZeroRotator;
		if (Kind == EMoteProjectileKind::Arrow)
		{
			if (Size.Z >= Size.X && Size.Z >= Size.Y) { Align = FRotator(-90.f, 0.f, 0.f); }
			else if (Size.Y >= Size.X) { Align = FRotator(0.f, -90.f, 0.f); }
		}
		Mesh->SetRelativeScale3D(FVector(Scale));
		Mesh->SetRelativeRotation(Align);
		Mesh->SetRelativeLocation(-Align.RotateVector(Box.GetCenter() * Scale));
	}
	else
	{
		// Glowing orb (energy bolts, fireballs, or any missing art).
		Mesh->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, SphereMeshPath));
		const float S = MeshSize / 100.f;
		Mesh->SetRelativeScale3D(FVector(S));
		Mesh->SetRelativeLocation(FVector::ZeroVector);
		Mesh->SetCastShadow(false);
		UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, AdditivePath, nullptr, LOAD_Quiet | LOAD_NoWarn);
		if (!Mat) { Mat = LoadObject<UMaterialInterface>(nullptr, BasicMaterialPath); }
		if (UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Mat, this))
		{
			const FLinearColor C = (Kind == EMoteProjectileKind::Fireball) ? FLinearColor(1.f, 0.45f, 0.1f) : Color;
			MID->SetVectorParameterValue(TEXT("Color"), C);
			MID->SetScalarParameterValue(TEXT("Intensity"), 8.f);
			MID->SetScalarParameterValue(TEXT("Opacity"), 1.f);
			MID->SetScalarParameterValue(TEXT("RimPower"), 1.5f);
			Mesh->SetMaterial(0, MID);
		}
		Glow->SetIntensity(60.f);
	}

	if (!Velocity.IsNearlyZero())
	{
		SetActorRotation(Velocity.Rotation());
	}
}

void AMoteProjectile::Reflect(AMoteCharacter* NewOwner)
{
	if (!IsReflectable())
	{
		return;
	}
	OwnerMote = NewOwner;
	AlreadyHit.Reset();
	bReturning = false;
	Age = FMath::Min(Age, Life * 0.3f);

	// Send it back at whoever threw it, a bit faster.
	FVector Dir = -Velocity.GetSafeNormal();
	Velocity = Dir * FMath::Max(Velocity.Size() * 1.25f, 1400.f);
	if (NewOwner)
	{
		Color = NewOwner->GetAccent();
		Glow->SetLightColor(Color);
	}
}

void AMoteProjectile::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bDetonated)
	{
		return;
	}
	Age += DeltaSeconds;

	// ---- Lightning: telegraph, then strike ----
	if (Kind == EMoteProjectileKind::Lightning)
	{
		if (Age >= LightningDelay)
		{
			Detonate();
		}
		return;
	}

	AMoteCharacter* Owner = OwnerMote.Get();

	// ---- motion ----
	switch (Kind)
	{
	case EMoteProjectileKind::Disc:
	{
		Mesh->AddLocalRotation(FRotator(0.f, 1500.f * DeltaSeconds, 0.f));
		if (Move.bProjectileReturns)
		{
			if (!bReturning && Age >= Life * 0.45f)
			{
				bReturning = true;
				AlreadyHit.Reset();
			}
			if (bReturning && Owner)
			{
				const FVector ToOwner = Owner->GetActorLocation() - GetActorLocation();
				const float Speed = FMath::Max(Velocity.Size(), 1800.f);
				Velocity = FMath::VInterpTo(Velocity, ToOwner.GetSafeNormal() * Speed, DeltaSeconds, 7.f);
				if (ToOwner.Size() < 110.f)
				{
					if (UMoteAudio* Audio = UMoteAudio::Get(this))
					{
						Audio->Play(TEXT("sfx_disc_catch"), 0.8f);
					}
					Destroy();
					return;
				}
			}
		}
		break;
	}
	case EMoteProjectileKind::Bomb:
	{
		Velocity.Z -= BombGravity * DeltaSeconds;
		Mesh->AddLocalRotation(FRotator(-400.f * DeltaSeconds, 0.f, 0.f));
		break;
	}
	default:
		break;
	}

	const FVector Prev = GetActorLocation();
	FVector Next = Prev + Velocity * DeltaSeconds;

	// Bombs bounce once on the platform, then blow on the next touch.
	if (Kind == EMoteProjectileKind::Bomb)
	{
		const AMoteGameMode* GM = GetWorld()->GetAuthGameMode<AMoteGameMode>();
		const AMoteArena* Arena = GM ? GM->GetArena() : nullptr;
		const float FloorZ = 30.f;
		if (Arena && Next.Z <= FloorZ && Prev.Z >= FloorZ - 5.f && Arena->IsOverPlatform(Next))
		{
			Next.Z = FloorZ;
			if (Bounces >= 1)
			{
				SetActorLocation(Next);
				Detonate();
				return;
			}
			++Bounces;
			Velocity.Z = -Velocity.Z * 0.45f;
			Velocity.X *= 0.7f;
			Velocity.Y *= 0.7f;
		}
	}
	SetActorLocation(Next);

	if (Kind == EMoteProjectileKind::Arrow || Kind == EMoteProjectileKind::EnergyBolt || Kind == EMoteProjectileKind::Fireball)
	{
		if (!Velocity.IsNearlyZero())
		{
			SetActorRotation(Velocity.Rotation());
		}
	}

	// ---- trail ----
	TrailTimer -= DeltaSeconds;
	if (TrailTimer <= 0.f)
	{
		TrailTimer = 0.03f;
		if (UMoteFX* FX = UMoteFX::Get(this))
		{
			const float Size = (Kind == EMoteProjectileKind::Fireball) ? 1.2f : (Kind == EMoteProjectileKind::Bomb ? 0.5f : 0.8f);
			FX->ProjectileTrail(GetActorLocation(), Kind == EMoteProjectileKind::Fireball ? FLinearColor(1.f, 0.4f, 0.08f) : Color, Size);
			if (Kind == EMoteProjectileKind::Fireball)
			{
				FX->FireBurst(GetActorLocation(), -Velocity.GetSafeNormal(), 0.35f);
			}
		}
	}

	CheckFighterOverlaps();
	if (bDetonated || IsActorBeingDestroyed())
	{
		return;
	}

	// ---- expiry ----
	const bool bReturningDisc = (Kind == EMoteProjectileKind::Disc && Move.bProjectileReturns);
	const AMoteGameMode* GM = GetWorld()->GetAuthGameMode<AMoteGameMode>();
	const bool bOut = GM && GM->GetArena() && GM->GetArena()->IsOutsideBlastZone(GetActorLocation());
	if (bOut || (!bReturningDisc && Age >= Life) || (bReturningDisc && Age >= Life * 2.5f))
	{
		if ((Kind == EMoteProjectileKind::Bomb || Kind == EMoteProjectileKind::Fireball) && !bOut)
		{
			Detonate();
		}
		else
		{
			Destroy();
		}
	}
}

void AMoteProjectile::CheckFighterOverlaps()
{
	AMoteCharacter* Owner = OwnerMote.Get();
	for (TActorIterator<AMoteCharacter> It(GetWorld()); It; ++It)
	{
		AMoteCharacter* Target = *It;
		if (!Target || Target == Owner || !Target->IsActiveInMatch() || AlreadyHit.Contains(Target))
		{
			continue;
		}
		if (FVector::Dist(Target->GetActorLocation(), GetActorLocation()) <= HitRadius + FighterRadius)
		{
			HitFighter(Target);
			if (bDetonated || IsActorBeingDestroyed())
			{
				return;
			}
		}
	}
}

void AMoteProjectile::HitFighter(AMoteCharacter* Target)
{
	if (Move.ExplosionRadius > 0.f)
	{
		Detonate();
		return;
	}

	AlreadyHit.Add(Target);

	FMoteHitInfo Hit;
	Hit.Attacker = OwnerMote.Get();
	Hit.Damage = Move.Damage * ChargeScale;
	Hit.BaseKnockback = Move.BaseKnockback * FMath::Lerp(1.f, ChargeScale, 0.5f);
	Hit.KnockbackGrowth = Move.KnockbackGrowth;
	Hit.LaunchAngle = Move.LaunchAngle;
	Hit.Direction = Velocity.GetSafeNormal2D();
	if (Hit.Direction.IsNearlyZero() && OwnerMote.IsValid())
	{
		Hit.Direction = (Target->GetActorLocation() - OwnerMote->GetActorLocation()).GetSafeNormal2D();
	}
	Hit.Location = GetActorLocation();
	Hit.Fx = Move.Fx;
	Hit.HitstopScale = Move.HitstopScale;
	Hit.ShakeScale = Move.ShakeScale;
	Hit.bRanged = true;

	const EMoteHitResult Result = Target->TakeHit(Hit);
	if (Result == EMoteHitResult::Ignored)
	{
		return;
	}

	if (Kind == EMoteProjectileKind::Disc && Move.bProjectileReturns)
	{
		// Bounce off and head home.
		bReturning = true;
		return;
	}
	if (!Move.bProjectilePierces || Result == EMoteHitResult::Blocked)
	{
		Destroy();
	}
}

void AMoteProjectile::Detonate()
{
	if (bDetonated)
	{
		return;
	}
	bDetonated = true;

	const FVector Center = GetActorLocation();
	const float Radius = FMath::Max(Move.ExplosionRadius, 120.f) * FMath::Lerp(1.f, ChargeScale, 0.5f);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		if (Kind == EMoteProjectileKind::Lightning)
		{
			FX->Lightning(Center, Radius, Color);
		}
		else
		{
			FX->Explosion(Center, Radius);
		}
	}
	if (UMoteAudio* Audio = UMoteAudio::Get(this))
	{
		Audio->Play(Kind == EMoteProjectileKind::Lightning ? TEXT("sfx_lightning") : TEXT("sfx_explosion"), 1.f, 1.f, 0.05f);
	}
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->Impact(Center, FMath::Clamp(Radius / 220.f, 0.4f, 1.4f));
	}

	AMoteCharacter* Owner = OwnerMote.Get();
	for (TActorIterator<AMoteCharacter> It(GetWorld()); It; ++It)
	{
		AMoteCharacter* Target = *It;
		if (!Target || Target == Owner || !Target->IsActiveInMatch())
		{
			continue;
		}
		const FVector Delta = Target->GetActorLocation() - Center;
		const bool bInside = (Kind == EMoteProjectileKind::Lightning)
			? (Delta.Size2D() <= Radius + FighterRadius && Delta.Z < 900.f && Delta.Z > -150.f)
			: (Delta.Size() <= Radius + FighterRadius);
		if (!bInside)
		{
			continue;
		}
		FMoteHitInfo Hit;
		Hit.Attacker = Owner;
		Hit.Damage = Move.Damage * ChargeScale;
		Hit.BaseKnockback = Move.BaseKnockback * FMath::Lerp(1.f, ChargeScale, 0.5f);
		Hit.KnockbackGrowth = Move.KnockbackGrowth;
		Hit.LaunchAngle = Move.LaunchAngle;
		Hit.Direction = Delta.GetSafeNormal2D().IsNearlyZero() ? Velocity.GetSafeNormal2D() : Delta.GetSafeNormal2D();
		Hit.Location = Target->GetActorLocation();
		Hit.Fx = Move.Fx;
		Hit.HitstopScale = Move.HitstopScale;
		Hit.ShakeScale = Move.ShakeScale;
		Hit.bRanged = true;
		Target->TakeHit(Hit);
	}

	Destroy();
}
