// Copyright Not Tim Games. All Rights Reserved.

#include "MoteAIController.h"

#include "MoteCharacter.h"
#include "EngineUtils.h"

AMoteAIController::AMoteAIController()
{
	PrimaryActorTick.bCanEverTick = true;
	bAttachToPawn = false;
}

AMoteCharacter* AMoteAIController::FindTarget()
{
	if (Target.IsValid() && !Target->IsDowned())
	{
		return Target.Get();
	}

	AMoteCharacter* Self = Cast<AMoteCharacter>(GetPawn());
	UWorld* World = GetWorld();
	if (!Self || !World)
	{
		return nullptr;
	}

	// Fight whoever isn't us - in a 1v1 that's the player.
	for (TActorIterator<AMoteCharacter> It(World); It; ++It)
	{
		AMoteCharacter* Other = *It;
		if (Other && Other != Self && !Other->IsDowned())
		{
			Target = Other;
			return Other;
		}
	}
	return nullptr;
}

void AMoteAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	AMoteCharacter* Self = Cast<AMoteCharacter>(GetPawn());
	if (!Self || Self->IsDowned())
	{
		return;
	}

	AMoteCharacter* Foe = FindTarget();
	if (!Foe)
	{
		return;
	}

	ThinkTimer -= DeltaSeconds;
	AttackCooldown -= DeltaSeconds;

	// Committed to a block this frame.
	if (ShieldTimer > 0.f)
	{
		ShieldTimer -= DeltaSeconds;
		Self->SetShielding(true);
		return;
	}
	Self->SetShielding(false);

	const FVector SelfLoc = Self->GetActorLocation();
	const FVector FoeLoc = Foe->GetActorLocation();
	const FVector Delta = FoeLoc - SelfLoc;
	const float Dist = Delta.Size2D();
	const FVector ToFoe = Delta.GetSafeNormal2D();

	// Ranged Cores hang back; melee Cores close the gap.
	const FMoteCoreDef& Def = FMoteCoreLibrary::Get(Self->GetCore());
	const EMoteAttackShape PrimaryShape = Def.Primary.Shape;
	const bool bRanged = (PrimaryShape == EMoteAttackShape::Projectile
		|| PrimaryShape == EMoteAttackShape::Lob);
	const float IdealRange = bRanged ? 800.f : FMath::Max(140.f, Def.Primary.Range - 60.f);

	if (ThinkTimer <= 0.f)
	{
		ThinkTimer = 0.14f;

		// Block if the foe is swinging at close quarters.
		const bool bFoeCommitted = !Foe->IsDowned() && Foe->IsShielding() == false;
		if (bFoeCommitted && Dist < 420.f && Self->GetShieldStamina() > 0.35f
			&& FMath::FRand() < 0.18f)
		{
			ShieldTimer = 0.45f;
			Self->SetShielding(true);
			return;
		}

		if (FMath::FRand() < 0.1f)
		{
			StrafeDir = -StrafeDir;
		}

		// Swing when in range and off cooldown; favour the primary.
		if (AttackCooldown <= 0.f && Dist < (bRanged ? 1300.f : IdealRange + 180.f))
		{
			const bool bTrySpecial = FMath::FRand() < 0.34f
				&& Self->GetCooldownRemaining(EMoteAttackSlot::Special) <= 0.f;

			if (bTrySpecial && Self->TryAttack(EMoteAttackSlot::Special))
			{
				AttackCooldown = 0.9f + FMath::FRand() * 0.7f;
			}
			else if (Self->TryAttack(EMoteAttackSlot::Primary))
			{
				AttackCooldown = 0.45f + FMath::FRand() * 0.5f;
			}
		}

		// Occasional hop to break up its movement and dodge shots.
		if (Dist > 400.f && FMath::FRand() < 0.06f)
		{
			Self->TryHop();
		}
	}

	// Steer: close or back off toward the preferred range, plus an orbit.
	FVector Move = FVector::ZeroVector;
	const float RangeError = Dist - IdealRange;
	if (FMath::Abs(RangeError) > 60.f)
	{
		Move += ToFoe * FMath::Sign(RangeError);
	}
	const FVector Orbit = FVector::CrossProduct(FVector::UpVector, ToFoe);
	Move += Orbit * 0.45f * StrafeDir;

	Self->SetMoveIntent(FVector2D(Move.X, Move.Y));

	// Always face the foe so attacks land where intended.
	const FRotator Facing = FRotator(0.f, ToFoe.Rotation().Yaw, 0.f);
	Self->SetActorRotation(FMath::RInterpTo(Self->GetActorRotation(), Facing, DeltaSeconds, 10.f));
}
