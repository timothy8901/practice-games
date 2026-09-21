// Copyright Not Tim Games. All Rights Reserved.
//
// The CPU opponent. It only ever presses the same buttons a player has, and it
// thinks on a timer so it reacts like a person rather than a machine.

#include "MoteAIController.h"

#include "MoteArena.h"
#include "MoteCharacter.h"
#include "MoteGameMode.h"

DEFINE_LOG_CATEGORY_STATIC(LogMoteAI, Log, All);

namespace
{
	/** Level 1..9 mapped to 0..1. */
	float Skill(int32 Level) { return FMath::Clamp((Level - 1) / 8.f, 0.f, 1.f); }
}

AMoteAIController::AMoteAIController()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AMoteAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	ThinkTimer = FMath::FRandRange(0.f, 0.15f);
	StrafeSign = FMath::RandBool() ? 1.f : -1.f;
	bWaitReturning = false;
}

void AMoteAIController::OnUnPossess()
{
	Super::OnUnPossess();
}

AMoteCharacter* AMoteAIController::GetFighter() const
{
	return Cast<AMoteCharacter>(GetPawn());
}

AMoteCharacter* AMoteAIController::PickTarget(AMoteGameMode* GM, AMoteCharacter* Me) const
{
	TArray<AMoteCharacter*> Foes;
	GM->GetOpponents(Me, Foes);
	AMoteCharacter* Best = nullptr;
	float BestDist = BIG_NUMBER;
	for (AMoteCharacter* F : Foes)
	{
		if (!F || F->GetFighterState() == EMoteFighterState::Respawning)
		{
			continue;
		}
		const float D = FVector::DistSquared(F->GetActorLocation(), Me->GetActorLocation());
		if (D < BestDist)
		{
			BestDist = D;
			Best = F;
		}
	}
	return Best;
}

void AMoteAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	AMoteCharacter* Me = GetFighter();
	AMoteGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
	if (!Me || !GM || !Me->IsActiveInMatch())
	{
		return;
	}
	const AMoteArena* Arena = GM->GetArena();
	if (!Arena)
	{
		return;
	}

	const float S = Skill(Level);
	const FVector MyLoc = Me->GetActorLocation();
	const float MyDistFromCentre = MyLoc.Size2D();
	const float Radius = Arena->GetPlatformRadius();

	// ---- think on a timer: reaction time shrinks with skill ----------------
	ThinkTimer -= DeltaSeconds;
	const bool bThink = (ThinkTimer <= 0.f);
	if (bThink)
	{
		ThinkTimer = FMath::Lerp(0.34f, 0.09f, S) * FMath::FRandRange(0.8f, 1.25f);
	}

	AMoteCharacter* Foe = PickTarget(GM, Me);

	// ========================================================================
	//  1. Recovery beats everything: get back over the stage.
	// ========================================================================
	const bool bOffStage = (MyDistFromCentre > Radius * 0.96f) || MyLoc.Z < -80.f;
	if (bOffStage && Me->GetFighterState() != EMoteFighterState::Respawning)
	{
		const FVector ToCentre = FVector(-MyLoc.X, -MyLoc.Y, 0.f).GetSafeNormal();
		Me->SetMoveInput(FVector2D(ToCentre.X, ToCentre.Y));
		Me->SetShieldHeld(false);

		if (!Me->IsGrounded())
		{
			const bool bFalling = Me->GetVelocity().Z < 30.f;
			// Jump back up while there are jumps left, then hover, then air dodge in.
			if (bFalling && Me->GetAirJumpsLeft() > 0 && MyLoc.Z < 420.f)
			{
				Me->PressJump();
			}
			Me->SetJumpHeld(true);  // hovering slows the fall on the way back

			const bool bDesperate = (MyLoc.Z < -420.f) || (MyDistFromCentre > Radius * 1.75f);
			if (bDesperate && Me->GetAirJumpsLeft() == 0 && Level >= 3)
			{
				Me->PressDodge();  // directional air dodge, the last recovery tool
			}
		}
		LogState(TEXT("recover"));
		return;
	}

	// Hover only when it helps; otherwise let go so jumps stay responsive.
	Me->SetJumpHeld(false);

	if (!Foe)
	{
		// The only opponent is KO'd or waiting on the respawn halo. Let go of
		// everything held - otherwise the shield stays up and drains, or a held
		// charge auto-fires at nothing - and keep moving, because a statue in
		// the middle of the stage reads as a hang.
		Me->SetShieldHeld(false);
		if (ChargeTimer > 0.f)
		{
			ChargeTimer = 0.f;
			Me->ReleaseHeavy();
		}
		// Pace with hysteresis: stroll out along screen left/right to half the
		// radius, head back in to a fifth of it, turn round, repeat. A single
		// threshold with opposing inputs on each side had the CPU dithering
		// across it every few frames, facing flicking back and forth - which
		// read as just as much of a glitch as the statue it replaced.
		const float FromCentre = MyLoc.Size2D();
		if (FromCentre > Radius * 0.5f)
		{
			bWaitReturning = true;
		}
		else if (bWaitReturning && FromCentre < Radius * 0.2f)
		{
			bWaitReturning = false;
			StrafeSign *= -1.f;
		}
		const FVector2D Drift = bWaitReturning
			? FVector2D(-MyLoc.X, -MyLoc.Y).GetSafeNormal() * 0.85f
			: FVector2D(0.f, StrafeSign * 0.35f);  // world Y = screen left/right under the fixed-yaw camera
		Me->SetMoveInput(Drift);
		LogState(TEXT("wait"));
		return;
	}

	// ========================================================================
	//  2. Read the situation.
	// ========================================================================
	const FVector FoeLoc = Foe->GetActorLocation();
	const FVector ToFoe = FoeLoc - MyLoc;
	const float Dist = ToFoe.Size2D();
	const float HeightDiff = FoeLoc.Z - MyLoc.Z;
	const FVector2D ToFoeDir = FVector2D(ToFoe.X, ToFoe.Y).GetSafeNormal();
	const FMoteFighterDef& Def = Me->GetFighterDef();

	// How this fighter likes to play: zoners hang back, brawlers get in.
	const FMoteMoveDef& Heavy = Def.GetMove(EMoteMoveSlot::Heavy);
	const FMoteMoveDef& Jab = Def.GetMove(EMoteMoveSlot::Jab1);
	const bool bZoner = (Heavy.Projectile != EMoteProjectileKind::None);
	const float JabRange = Jab.Reach + 40.f;
	// A zoner still wants to outrange a jab, but 820 cm on an 850 cm stage meant
	// it spent the whole match sprinting away and nobody ever landed anything.
	const float PreferredRange = bZoner
		? FMath::Clamp(JabRange * 2.2f, 280.f, Radius * 0.45f)
		: JabRange * 0.8f;

	// Is the opponent about to hit us?
	bool bIncoming = false;
	if (const FMoteMoveDef* FoeMove = Foe->GetCurrentMove())
	{
		const bool bStartingUp = Foe->GetMovePhase() == EMoteMovePhase::Startup
			|| Foe->GetMovePhase() == EMoteMovePhase::Charging;
		const float Threat = FoeMove->Reach + FoeMove->Radius + 120.f;
		bIncoming = bStartingUp && Dist < Threat && FMath::Abs(HeightDiff) < 220.f;
	}

	// ========================================================================
	//  3. Defence: shield or dodge what we can see coming.
	// ========================================================================
	if (bIncoming && Level >= 2 && DefendTimer <= 0.f && bThink)
	{
		if (FMath::FRand() < FMath::Lerp(0.15f, 0.9f, S))
		{
			// Shielding is ground-only, so in the air the shield branch just
			// zeroes the input and returns - the CPU went limp for the whole
			// defend window. Air-dodge instead.
			bDefendByDodge = !Me->IsGrounded() || FMath::FRand() < FMath::Lerp(0.2f, 0.5f, S);
			DefendTimer = FMath::FRandRange(0.25f, 0.5f);
		}
	}
	if (DefendTimer > 0.f)
	{
		DefendTimer -= DeltaSeconds;
		const bool bAir = !Me->IsGrounded();
		const FVector2D My2D(MyLoc.X, MyLoc.Y);
		const FVector2D Inward = (-My2D).GetSafeNormal();
		if (bDefendByDodge)
		{
			// Aim the dodge where it will END, not merely away from the attacker.
			// With the foe on the inward side, straight back rolls or air-dodges
			// the CPU off the stage - and in the air burns the dodge its recovery
			// relies on. Try straight away, then the two sideways escapes (the one
			// leaning toward centre first), and take the first that stays on.
			const float Travel = bAir ? 450.f : 360.f;
			const float SafeR = Radius * 0.85f;
			FVector2D SideA(-ToFoeDir.Y, ToFoeDir.X);
			FVector2D SideB = -SideA;
			const float DotA = FVector2D::DotProduct(SideA, Inward);
			const float DotB = FVector2D::DotProduct(SideB, Inward);
			if (DotB > DotA || (FMath::IsNearlyEqual(DotA, DotB, 0.05f) && StrafeSign < 0.f))
			{
				Swap(SideA, SideB);
			}
			const FVector2D Candidates[] = { -ToFoeDir, SideA, SideB };
			FVector2D Aim = FVector2D::ZeroVector;
			if (!bAir || Me->HasAirDodge())
			{
				for (const FVector2D& Dir : Candidates)
				{
					if ((My2D + Dir * Travel).Size() <= SafeR)
					{
						Aim = Dir;
						break;
					}
				}
			}
			if (!Aim.IsNearlyZero())
			{
				// Terminal: every branch below calls SetMoveInput again. The dodge
				// carries its own aim (PressDodge(Dir)), so nothing can re-aim it.
				Me->SetShieldHeld(false);
				Me->PressDodge(Aim);
				DefendTimer = 0.f;
				LogState(TEXT("dodge"));
				return;
			}
			// Nowhere safe to dodge to: block instead (grounded; see below).
			bDefendByDodge = false;
		}
		if (bAir)
		{
			// Shields are ground-only, so a shield press in the air does nothing
			// and the zeroed input just leaves the CPU limp. Drift home instead,
			// keeping the air dodge in reserve for recovery.
			Me->SetShieldHeld(false);
			Me->SetMoveInput(Inward);
			DefendTimer = 0.f;
			LogState(TEXT("defend-drift"));
			return;
		}
		Me->SetShieldHeld(true);
		Me->SetMoveInput(FVector2D::ZeroVector);
		LogState(TEXT("defend"));
		return;
	}
	Me->SetShieldHeld(false);

	// ========================================================================
	//  4. Release a charge we are holding.
	// ========================================================================
	if (ChargeTimer > 0.f)
	{
		ChargeTimer -= DeltaSeconds;
		Me->SetMoveInput(ToFoeDir * 0.25f);
		if (ChargeTimer <= 0.f)
		{
			Me->ReleaseHeavy();
		}
		return;
	}
	Me->ReleaseHeavy();

	// ========================================================================
	//  5. Punish: a shield-broken or badly stunned opponent gets the big one.
	// ========================================================================
	const bool bFoeHelpless = (Foe->GetFighterState() == EMoteFighterState::ShieldBroken)
		|| (Foe->IsInHitstun() && Foe->GetPercent() > 60.f);
	if (bFoeHelpless && Dist < Heavy.Reach + 260.f && Level >= 3)
	{
		Me->SetMoveInput(ToFoeDir);
		if (Dist < Heavy.Reach + 80.f)
		{
			Me->PressHeavy();
			ChargeTimer = FMath::Lerp(0.f, 0.5f, S);
		}
		LogState(TEXT("punish"));
		return;
	}

	// ========================================================================
	//  6. Edge-guard: they are off-stage, make it worse (without following far).
	// ========================================================================
	const float FoeDistFromCentre = FoeLoc.Size2D();
	const bool bFoeOffStage = FoeDistFromCentre > Radius * 1.05f || FoeLoc.Z < -120.f;
	if (bFoeOffStage && Level >= 4 && MyDistFromCentre < Radius * 0.85f)
	{
		Me->SetMoveInput(ToFoeDir * 0.3f);
		if (bThink && bZoner && FMath::FRand() < 0.6f)
		{
			Me->PressHeavy();
			Me->ReleaseHeavy();  // quick shot, no charge
		}
		else if (bThink && Dist < JabRange * 1.4f && FMath::FRand() < 0.4f)
		{
			Me->PressLight();
		}
		LogState(TEXT("edgeguard"));
		return;
	}

	// ========================================================================
	//  7. Neutral: hold the preferred range, circle, and attack in range.
	// ========================================================================
	FVector2D Move = FVector2D::ZeroVector;
	const float RangeError = Dist - PreferredRange;
	if (FMath::Abs(RangeError) > 60.f)
	{
		// Asymmetric on purpose. A symmetric ramp decays the closing stick to
		// nothing exactly as the chaser arrives, so two fighters settle just
		// outside jab range and circle each other for the whole match. Close
		// hard; back off gently.
		const float Drive = (RangeError > 0.f)
			? FMath::Min(RangeError / 90.f, 1.f)
			: FMath::Max(RangeError / 220.f, -0.45f);
		Move = ToFoeDir * Drive;
	}
	if (bThink && FMath::FRand() < 0.18f)
	{
		StrafeSign *= -1.f;
	}
	Move += FVector2D(-ToFoeDir.Y, ToFoeDir.X) * StrafeSign * FMath::Lerp(0.15f, 0.42f, S);

	// Never walk off the edge while manoeuvring.
	if (MyDistFromCentre > Radius * 0.72f)
	{
		const FVector2D Inward = -FVector2D(MyLoc.X, MyLoc.Y).GetSafeNormal();
		const float Pull = FMath::GetMappedRangeValueClamped(
			FVector2D(Radius * 0.72f, Radius * 0.95f), FVector2D(0.f, 1.6f), MyDistFromCentre);
		Move += Inward * Pull;
	}
	Me->SetMoveInput(Move.GetClampedToMaxSize(1.f));
	LogState(TEXT("neutral"));

	// Jump in now and then, or to chase someone above us.
	if (bThink && Me->IsGrounded())
	{
		const bool bWantAir = (HeightDiff > 180.f && Dist < 700.f) || FMath::FRand() < FMath::Lerp(0.03f, 0.12f, S);
		if (bWantAir)
		{
			Me->PressJump();
		}
	}

	// ---- attacks ----
	if (!bThink)
	{
		return;
	}
	const float AttackChance = FMath::Lerp(0.35f, 0.95f, S);

	if (!Me->IsGrounded())
	{
		if (Dist < 320.f && FMath::Abs(HeightDiff) < 260.f && FMath::FRand() < AttackChance)
		{
			// Aerials: the heavy one when we are above them (plunges and spikes).
			if (HeightDiff < -120.f && FMath::FRand() < 0.6f)
			{
				Me->PressHeavy();
				Me->ReleaseHeavy();
			}
			else
			{
				Me->PressLight();
			}
		}
		return;
	}

	// JabRange, not JabRange * 1.6: the gap between the two left a dead band
	// where a zoner would neither shoot nor jab, which is where it spent most
	// of the match.
	if (bZoner && Dist > JabRange && Dist < 2200.f)
	{
		if (FMath::FRand() < AttackChance)
		{
			Me->PressHeavy();
			ChargeTimer = (Dist > 1200.f) ? FMath::Lerp(0.1f, 0.7f, S) : 0.f;
			if (ChargeTimer <= 0.f)
			{
				Me->ReleaseHeavy();
			}
		}
		return;
	}

	if (Dist < JabRange && FMath::Abs(HeightDiff) < 200.f && FMath::FRand() < AttackChance)
	{
		// Mostly jab strings; a charged heavy when they are ripe for a KO.
		const bool bGoForKill = Foe->GetPercent() > FMath::Lerp(140.f, 85.f, S) && FMath::FRand() < 0.5f;
		if (bGoForKill)
		{
			Me->PressHeavy();
			ChargeTimer = FMath::Lerp(0.f, 0.4f, S);
			if (ChargeTimer <= 0.f)
			{
				Me->ReleaseHeavy();
			}
		}
		else
		{
			Me->PressLight();
		}
	}
}

void AMoteAIController::LogState(const TCHAR* What)
{
	if (LastState != What)
	{
		LastState = What;
		UE_LOG(LogMoteAI, Verbose, TEXT("%s -> %s"), GetPawn() ? *GetPawn()->GetName() : TEXT("?"), What);
	}
}
