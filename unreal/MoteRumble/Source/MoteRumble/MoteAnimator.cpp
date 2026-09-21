// Copyright Not Tim Games. All Rights Reserved.
//
// Procedural animation. A Mote has no skeleton: it is a floating body, two
// detached gauntlets and a weapon, so every pose here is authored as maths.
//
// Everything is in the fighter's VisualRoot space: +X forward, +Y right, +Z up,
// centimetres, body centred on the origin.

#include "MoteAnimator.h"

#include "MoteCharacter.h"
#include "Components/StaticMeshComponent.h"

namespace
{
	// ---- easing ----
	float EaseOut(float T) { return 1.f - FMath::Pow(1.f - FMath::Clamp(T, 0.f, 1.f), 3.f); }
	float EaseIn(float T) { const float X = FMath::Clamp(T, 0.f, 1.f); return X * X * X; }
	float EaseInOut(float T) { const float X = FMath::Clamp(T, 0.f, 1.f); return X * X * (3.f - 2.f * X); }
	/** Fast strike: almost all of the motion in the first third. */
	float Snap(float T) { return 1.f - FMath::Pow(1.f - FMath::Clamp(T, 0.f, 1.f), 6.f); }
	float Overshoot(float T, float Amount)
	{
		const float X = EaseOut(T);
		return X + FMath::Sin(FMath::Clamp(T, 0.f, 1.f) * PI) * Amount;
	}

	/** Where a hand sits: angle 0 = straight ahead, +90 = the fighter's right. */
	FVector HandAt(float AngleDeg, float Radius, float Height)
	{
		const float A = FMath::DegreesToRadians(AngleDeg);
		return FVector(FMath::Cos(A) * Radius, FMath::Sin(A) * Radius, Height);
	}

}

UMoteAnimator::UMoteAnimator()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UMoteAnimator::Initialize(USceneComponent* InBodyPivot, UStaticMeshComponent* InGauntletL,
	UStaticMeshComponent* InGauntletR, USceneComponent* InWeaponPivot, UStaticMeshComponent* InWeaponMesh,
	const FMoteFighterDef& Def, float InBodyHeight, float InWeaponReach)
{
	BodyPivot = InBodyPivot;
	GauntletL = InGauntletL;
	GauntletR = InGauntletR;
	WeaponPivot = InWeaponPivot;
	WeaponMesh = InWeaponMesh;
	Hold = Def.Hold;
	Core = Def.Core;
	BodyHeight = FMath::Max(InBodyHeight, 40.f);
	WeaponReach = FMath::Max(InWeaponReach, 30.f);
	GauntletScaleR = InGauntletR ? InGauntletR->GetRelativeScale3D() : FVector::OneVector;
	GauntletScaleL = InGauntletL ? InGauntletL->GetRelativeScale3D() : FVector(1.f, -1.f, 1.f);
	// FitMesh centres each gauntlet's bounds on its own origin by writing a
	// relative location. The gauntlet GLBs are modelled from their base, so
	// that offset is 9-22 cm; posing used to overwrite it and the fist ended
	// up floating above the grip. Keep it and add it back every frame.
	GauntletOffsetR = InGauntletR ? InGauntletR->GetRelativeLocation() : FVector::ZeroVector;
	GauntletOffsetL = InGauntletL ? InGauntletL->GetRelativeLocation() : FVector::ZeroVector;
	bInitialised = false;
}

// ---------------------------------------------------------------------------
//  Pose building
// ---------------------------------------------------------------------------

float UMoteAnimator::HandRadius() const { return BodyHeight * 0.56f; }

/** The relaxed pose the fighter returns to. */
void UMoteAnimator::BuildIdlePose(const FMoteAnimState& S, FMotePose& P) const
{
	const float R = HandRadius();
	const float Bob = FMath::Sin(S.Time * 2.4f) * BodyHeight * 0.035f;
	const float Breathe = 1.f + FMath::Sin(S.Time * 2.4f + 0.6f) * 0.018f;

	P.BodyOffset = FVector(0.f, 0.f, Bob);
	P.BodyScale = FVector(1.f / FMath::Sqrt(Breathe), 1.f / FMath::Sqrt(Breathe), Breathe);

	// Hands float at the sides, out of phase with the body so they feel light.
	const float HandBob = FMath::Sin(S.Time * 2.4f - 0.9f) * BodyHeight * 0.03f;
	P.HandR = HandAt(58.f, R, -BodyHeight * 0.10f + HandBob);
	P.HandL = HandAt(-58.f, R, -BodyHeight * 0.10f - HandBob);

	// Running: lean into the direction of travel and pump the hands.
	if (S.Speed01 > 0.05f)
	{
		const float Lean = FMath::Min(S.Speed01, 1.2f) * 11.f;
		P.BodyRot.Pitch += Lean;
		const float Pump = FMath::Sin(S.Time * 13.f) * BodyHeight * 0.09f * FMath::Min(S.Speed01, 1.f);
		P.HandR.X += Pump;
		P.HandL.X -= Pump;
		P.HandR.Y -= 4.f;
		P.HandL.Y += 4.f;
	}

	if (!S.bGrounded)
	{
		// Airborne: stretch upward when rising, tuck when falling.
		const float VZ = FMath::Clamp(S.Velocity.Z / 1400.f, -1.f, 1.f);
		P.BodyScale.Z *= 1.f + VZ * 0.10f;
		P.BodyScale.X *= 1.f - VZ * 0.05f;
		P.BodyScale.Y *= 1.f - VZ * 0.05f;
		P.HandR.Z -= VZ * BodyHeight * 0.10f;
		P.HandL.Z -= VZ * BodyHeight * 0.10f;
		if (S.bHovering)
		{
			// Hands spread wide like a parachute.
			P.HandR = HandAt(78.f, R * 1.25f, BodyHeight * 0.16f + FMath::Sin(S.Time * 7.f) * 3.f);
			P.HandL = HandAt(-78.f, R * 1.25f, BodyHeight * 0.16f - FMath::Sin(S.Time * 7.f) * 3.f);
		}
	}

	// Landing squash, and the takeoff stretch just after a jump.
	if (S.bGrounded && S.TimeSinceLanded < 0.22f)
	{
		const float A = 1.f - S.TimeSinceLanded / 0.22f;
		const float Squash = A * 0.22f;
		P.BodyScale.Z *= 1.f - Squash;
		P.BodyScale.X *= 1.f + Squash * 0.6f;
		P.BodyScale.Y *= 1.f + Squash * 0.6f;
		P.BodyOffset.Z -= Squash * BodyHeight * 0.25f;
	}
	if (S.TimeSinceJump < 0.25f)
	{
		const float A = 1.f - S.TimeSinceJump / 0.25f;
		P.BodyScale.Z *= 1.f + A * 0.16f;
		P.BodyScale.X *= 1.f - A * 0.08f;
		P.BodyScale.Y *= 1.f - A * 0.08f;
		// A mid-air jump is a quick forward flip.
		if (S.AirJumpsUsed > 0 && !S.bGrounded)
		{
			P.BodyRot.Pitch += 360.f * EaseOut(FMath::Min(S.TimeSinceJump / 0.45f, 1.f));
		}
	}
}

/**
 * Where the weapon and hands go for the attack archetype being played.
 * Alpha is 0..1 across the whole move; Phase tells us which part we are in.
 */
void UMoteAnimator::BuildAttackPose(const FMoteAnimState& S, FMotePose& P) const
{
	const float R = HandRadius();
	const float Reach = WeaponReach;

	// Normalised progress through the three beats of a swing.
	const bool bCharging = (S.Phase == EMoteMovePhase::Charging);
	const bool bStartup = (S.Phase == EMoteMovePhase::Startup);
	const bool bActive = (S.Phase == EMoteMovePhase::Active);
	const float PA = FMath::Clamp(S.PhaseAlpha, 0.f, 1.f);

	// Wind: 0 at rest -> 1 fully wound up. Strike: 0 -> 1 through the hit.
	const float Wind = bCharging ? 1.f : (bStartup ? EaseOut(PA) : 1.f);
	const float Strike = bActive ? Snap(PA) : (bStartup ? 0.f : 1.f);
	const float Settle = (!bActive && !bStartup && !bCharging) ? EaseInOut(PA) : 0.f;

	// Charging adds a tremble and a deeper coil.
	const float Tremble = bCharging ? FMath::Sin(S.Time * 46.f) * S.Charge01 * 2.6f : 0.f;

	P.bTrail = bActive || (bStartup && PA > 0.7f);

	auto SweepWeapon = [&](float FromAngle, float ToAngle, float FromHeight, float ToHeight,
		float WeaponYawOffset, float WeaponPitch, float BodyTwist)
	{
		const float Angle = FMath::Lerp(FMath::Lerp(58.f, FromAngle, Wind), ToAngle, Strike);
		const float Height = FMath::Lerp(FMath::Lerp(-BodyHeight * 0.1f, FromHeight, Wind), ToHeight, Strike);
		P.HandR = HandAt(Angle + Tremble, R * 1.05f, Height);
		P.HandL = HandAt(-FMath::Lerp(58.f, 34.f, Wind), R * 0.95f, -BodyHeight * 0.08f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(WeaponPitch, Angle + WeaponYawOffset, 0.f);
		P.BodyRot.Yaw += FMath::Lerp(FMath::Lerp(0.f, -BodyTwist, Wind), BodyTwist, Strike);
		P.BodyRot.Pitch += Strike * 6.f - Wind * 4.f;
	};

	switch (S.MoveAnim)
	{
	case EMoteMoveAnim::SlashRight:
		// Wind up over the right shoulder, cut down-left across the front.
		SweepWeapon(128.f, -78.f, BodyHeight * 0.30f, -BodyHeight * 0.05f, -52.f, -8.f, 16.f);
		break;

	case EMoteMoveAnim::SlashLeft:
		SweepWeapon(-118.f, 84.f, BodyHeight * 0.26f, -BodyHeight * 0.02f, 52.f, -6.f, -16.f);
		break;

	case EMoteMoveAnim::BowBash:
		SweepWeapon(112.f, -56.f, BodyHeight * 0.12f, 0.f, -40.f, 10.f, 12.f);
		break;

	case EMoteMoveAnim::Overhead:
	case EMoteMoveAnim::GroundSlam:
	{
		// Raise high overhead, then smash down in front.
		const float Up = FMath::Lerp(0.f, 1.f, Wind);
		const float Down = Strike;
		const float Height = FMath::Lerp(FMath::Lerp(-BodyHeight * 0.1f, BodyHeight * 0.85f, Up),
			-BodyHeight * 0.55f, Down);
		const float Fwd = FMath::Lerp(FMath::Lerp(0.35f, -0.15f, Up), 1.0f, Down);
		P.HandR = FVector(R * Fwd, R * 0.30f + Tremble, Height);
		P.HandL = FVector(R * Fwd * 0.9f, -R * 0.30f, Height);
		P.WeaponLoc = (P.HandR + P.HandL) * 0.5f;
		P.WeaponRot = FRotator(FMath::Lerp(FMath::Lerp(30.f, 86.f, Up), -74.f, Down), 0.f, 0.f);
		P.BodyRot.Pitch += FMath::Lerp(-14.f * Up, 26.f * Down, Down);
		P.BodyScale.Z *= 1.f + Up * 0.06f - Down * 0.10f;
		break;
	}

	case EMoteMoveAnim::Thrust:
	case EMoteMoveAnim::Drill:
	case EMoteMoveAnim::DashStrike:
	{
		// Coil back, then drive straight forward.
		const float Ext = FMath::Lerp(FMath::Lerp(0.45f, -0.25f, Wind), 1.5f, Strike);
		const float Spin = (S.MoveAnim == EMoteMoveAnim::Drill) ? S.Time * 1500.f : 0.f;
		P.HandR = FVector(R * Ext, R * 0.26f, -BodyHeight * 0.05f + Tremble);
		P.HandL = FVector(R * Ext * 0.7f, -R * 0.26f, -BodyHeight * 0.08f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(0.f, 0.f, Spin);
		P.BodyRot.Pitch += Strike * 12.f - Wind * 8.f;
		P.BodyScale.X *= 1.f + Strike * 0.10f;
		P.BodyScale.Y *= 1.f - Strike * 0.05f;
		break;
	}

	case EMoteMoveAnim::Uppercut:
	case EMoteMoveAnim::FlameUppercut:
	{
		const float Rise = Strike;
		const float Height = FMath::Lerp(FMath::Lerp(-BodyHeight * 0.1f, -BodyHeight * 0.5f, Wind),
			BodyHeight * 0.95f, Rise);
		P.HandR = FVector(R * 0.75f, R * 0.18f, Height + Tremble);
		P.HandL = HandAt(-52.f, R, -BodyHeight * 0.05f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(FMath::Lerp(-20.f, 84.f, Rise), 0.f, 0.f);
		P.BodyRot.Pitch -= Rise * 18.f;
		P.BodyScale.Z *= 1.f + Rise * 0.12f;
		break;
	}

	case EMoteMoveAnim::SpinSlash:
	case EMoteMoveAnim::Twirl:
	case EMoteMoveAnim::ParasolSpin:
	{
		// The whole fighter spins with the weapon held out. SpinYaw is applied
		// after smoothing (see UpdatePose) so the hands and weapon orbit with
		// the body - writing it into BodyRot only ever turned the egg, because
		// the gauntlets and weapon are siblings of BodyPivot, not children.
		const float Turns = (S.MoveAnim == EMoteMoveAnim::SpinSlash) ? 1.f : 2.f;
		const float Spin = Strike * 360.f * Turns;
		const float Out = FMath::Lerp(0.85f, 1.25f, Strike);
		P.SpinYaw = Spin;
		P.HandR = HandAt(70.f, R * Out, -BodyHeight * 0.02f);
		P.HandL = HandAt(-70.f, R * Out, -BodyHeight * 0.02f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-4.f, 82.f, (S.MoveAnim == EMoteMoveAnim::ParasolSpin) ? 90.f : 0.f);
		P.BodyScale.Z *= 1.f - Strike * 0.05f;
		break;
	}

	case EMoteMoveAnim::ThrowForward:
	case EMoteMoveAnim::Lob:
	{
		const bool bLob = (S.MoveAnim == EMoteMoveAnim::Lob);
		// Wind back past the shoulder, then whip forward and release.
		const float Back = Wind;
		const float Fling = Strike;
		const float X = FMath::Lerp(FMath::Lerp(0.35f, -0.55f, Back), 1.15f, Fling) * R;
		const float Z = bLob
			? FMath::Lerp(FMath::Lerp(-BodyHeight * 0.1f, -BodyHeight * 0.55f, Back), BodyHeight * 0.5f, Fling)
			: FMath::Lerp(FMath::Lerp(-BodyHeight * 0.1f, BodyHeight * 0.45f, Back), BodyHeight * 0.1f, Fling);
		P.HandR = FVector(X, R * 0.34f + Tremble, Z);
		P.HandL = HandAt(-46.f, R, -BodyHeight * 0.05f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(bLob ? -40.f + Fling * 60.f : 0.f, 0.f, 0.f);
		P.BodyRot.Yaw += FMath::Lerp(-18.f * Back, 22.f * Fling, Fling);
		// The thrown thing leaves the hand: hide it until the move ends.
		if (!bStartup && !bCharging && (bActive ? PA > 0.25f : true))
		{
			P.bWeaponVisible = false;
			P.bTrailSource = false;
		}
		break;
	}

	case EMoteMoveAnim::DrawBow:
	{
		// Bow out front in the left hand, right hand draws the string back.
		const float Draw = bCharging ? S.Charge01 : (bStartup ? EaseOut(PA) : 1.f);
		const float Release = bActive ? Snap(PA) : (bStartup || bCharging ? 0.f : 1.f);
		P.HandL = FVector(R * 1.05f, -R * 0.12f, BodyHeight * 0.05f);
		const float Pull = FMath::Lerp(0.25f, -0.55f, Draw) + Release * 0.5f;
		P.HandR = FVector(R * Pull, R * 0.12f, BodyHeight * 0.02f + Tremble);
		P.WeaponLoc = P.HandL;
		// Bow stands upright: +X of the pivot points up.
		P.WeaponRot = FRotator(90.f, 0.f, 0.f);
		P.BodyRot.Yaw -= 12.f * Draw;
		P.BodyRot.Pitch += Release * 8.f;
		break;
	}

	case EMoteMoveAnim::PunchRight:
	case EMoteMoveAnim::PunchLeft:
	{
		const bool bRight = (S.MoveAnim == EMoteMoveAnim::PunchRight);
		const float Ext = FMath::Lerp(FMath::Lerp(0.5f, 0.1f, Wind), 1.55f, Strike);
		const FVector Punch(R * Ext, (bRight ? 1.f : -1.f) * R * 0.22f, -BodyHeight * 0.02f + Tremble);
		const FVector Guard(R * 0.45f, (bRight ? -1.f : 1.f) * R * 0.5f, BodyHeight * 0.06f);
		P.HandR = bRight ? Punch : Guard;
		P.HandL = bRight ? Guard : Punch;
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator::ZeroRotator;
		P.BodyRot.Yaw += (bRight ? 1.f : -1.f) * (Strike * 20.f - Wind * 10.f);
		P.BodyScale.X *= 1.f + Strike * 0.08f;
		break;
	}

	case EMoteMoveAnim::Plunge:
	{
		// Point everything straight down and dive.
		P.HandR = FVector(R * 0.35f, R * 0.22f, -BodyHeight * 0.2f);
		P.HandL = FVector(R * 0.35f, -R * 0.22f, -BodyHeight * 0.2f);
		P.WeaponLoc = (P.HandR + P.HandL) * 0.5f;
		P.WeaponRot = FRotator(-88.f, 0.f, 0.f);
		P.BodyRot.Pitch += 26.f;
		P.BodyScale.Z *= 1.12f;
		P.BodyScale.X *= 0.94f;
		P.BodyScale.Y *= 0.94f;
		break;
	}

	case EMoteMoveAnim::Cast:
	{
		// Weapon raised to the sky, body arched back, then a sharp point forward.
		const float Raise = Wind;
		const float Point = Strike;
		P.HandR = FVector(R * FMath::Lerp(-0.1f, 0.9f, Point), R * 0.2f,
			FMath::Lerp(FMath::Lerp(0.f, BodyHeight * 0.9f, Raise), BodyHeight * 0.35f, Point) + Tremble);
		P.HandL = HandAt(-60.f, R, -BodyHeight * 0.05f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(FMath::Lerp(88.f, 30.f, Point), 0.f, 0.f);
		P.BodyRot.Pitch -= Raise * 14.f - Point * 20.f;
		break;
	}

	default:
		SweepWeapon(120.f, -70.f, BodyHeight * 0.25f, 0.f, -45.f, 0.f, 14.f);
		break;
	}

	// Settle back toward idle through the recovery beat.
	if (Settle > 0.f)
	{
		FMotePose Idle;
		BuildIdlePose(S, Idle);
		const float A = EaseInOut(Settle);
		P.HandR = FMath::Lerp(P.HandR, Idle.HandR, A);
		P.HandL = FMath::Lerp(P.HandL, Idle.HandL, A);
		P.WeaponLoc = FMath::Lerp(P.WeaponLoc, Idle.HandR, A);
		P.WeaponRot = FMath::Lerp(P.WeaponRot, FRotator(-18.f, 40.f, 0.f), A);
		P.BodyRot = FMath::Lerp(P.BodyRot, Idle.BodyRot, A);
		P.BodyScale = FMath::Lerp(P.BodyScale, Idle.BodyScale, A);
		if (A > 0.55f)
		{
			P.bWeaponVisible = true;  // the thrown weapon is back in hand
			P.bTrailSource = true;
		}
	}
}

void UMoteAnimator::BuildPose(const FMoteAnimState& S, FMotePose& P) const
{
	const float R = HandRadius();

	switch (S.State)
	{
	case EMoteFighterState::Attacking:
		BuildIdlePose(S, P);
		P.BodyOffset = FVector::ZeroVector;
		BuildAttackPose(S, P);
		break;

	case EMoteFighterState::Shielding:
		BuildIdlePose(S, P);
		// Crouch a little and brace both fists in front.
		P.BodyScale.Z *= 0.92f;
		P.BodyScale.X *= 1.05f;
		P.BodyScale.Y *= 1.05f;
		P.BodyOffset.Z -= BodyHeight * 0.06f;
		P.HandR = FVector(R * 0.7f, R * 0.34f, BodyHeight * 0.02f);
		P.HandL = FVector(R * 0.7f, -R * 0.34f, BodyHeight * 0.02f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-40.f, 30.f, 0.f);
		break;

	case EMoteFighterState::Dodging:
	{
		BuildIdlePose(S, P);
		// Tuck and spin along the dodge direction.
		const float A = FMath::Clamp(S.StateTime / 0.42f, 0.f, 1.f);
		P.BodyRot.Pitch += 360.f * EaseInOut(A);
		P.BodyScale.Z *= 0.86f;
		P.BodyScale.X *= 1.10f;
		P.BodyScale.Y *= 1.10f;
		P.HandR = HandAt(40.f, R * 0.7f, -BodyHeight * 0.2f);
		P.HandL = HandAt(-40.f, R * 0.7f, -BodyHeight * 0.2f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-60.f, 20.f, 0.f);
		break;
	}

	case EMoteFighterState::Hitstun:
	{
		BuildIdlePose(S, P);
		if (S.bTumble)
		{
			// Tumble end over end around the axis across the launch direction.
			const float Spin = S.StateTime * 760.f;
			const FVector Dir = S.LaunchDirection.GetSafeNormal2D();
			P.BodyRot.Pitch += Spin * (Dir.X >= 0.f ? 1.f : -1.f);
			P.BodyRot.Roll += Spin * 0.35f * (Dir.Y >= 0.f ? 1.f : -1.f);
			P.HandR = HandAt(96.f, R * 1.25f, BodyHeight * 0.18f);
			P.HandL = HandAt(-96.f, R * 1.25f, BodyHeight * 0.18f);
		}
		else
		{
			// A sharp recoil away from the hit.
			const float A = 1.f - FMath::Clamp(S.StateTime / 0.25f, 0.f, 1.f);
			P.BodyRot.Pitch -= 22.f * A;
			P.BodyScale.X *= 1.f + A * 0.12f;
			P.BodyScale.Z *= 1.f - A * 0.10f;
			P.HandR = HandAt(84.f, R * 1.1f, BodyHeight * 0.1f * A);
			P.HandL = HandAt(-84.f, R * 1.1f, BodyHeight * 0.1f * A);
		}
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-50.f, 60.f, 0.f);
		break;
	}

	case EMoteFighterState::ShieldBroken:
	{
		BuildIdlePose(S, P);
		const float Wobble = FMath::Sin(S.Time * 9.f);
		P.BodyRot.Roll += Wobble * 16.f;
		P.BodyRot.Pitch += FMath::Cos(S.Time * 7.f) * 10.f;
		P.HandR = HandAt(70.f + Wobble * 20.f, R * 1.1f, BodyHeight * 0.12f);
		P.HandL = HandAt(-70.f - Wobble * 20.f, R * 1.1f, BodyHeight * 0.12f);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-70.f, 50.f, 0.f);
		break;
	}

	case EMoteFighterState::Respawning:
	{
		// Serene float, hands spread, slow turn.
		const float Float = FMath::Sin(S.Time * 1.8f) * BodyHeight * 0.05f;
		P.BodyOffset = FVector(0.f, 0.f, Float);
		P.BodyRot = FRotator(0.f, S.Time * 40.f, 0.f);
		P.HandR = HandAt(80.f, R * 1.15f, BodyHeight * 0.05f + Float);
		P.HandL = HandAt(-80.f, R * 1.15f, BodyHeight * 0.05f - Float);
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-25.f, 70.f, 0.f);
		break;
	}

	case EMoteFighterState::Victory:
	{
		// A celebratory flourish, different per fighter.
		const float T = S.StateTime;
		const int32 Flavour = static_cast<int32>(Core) % 4;
		BuildIdlePose(S, P);
		P.BodyOffset.Z += FMath::Abs(FMath::Sin(T * 3.2f)) * BodyHeight * 0.12f;
		switch (Flavour)
		{
		case 0:  // weapon raised high
			P.HandR = FVector(R * 0.3f, R * 0.25f, BodyHeight * 0.9f);
			P.WeaponRot = FRotator(85.f, 0.f, 0.f);
			break;
		case 1:  // slow spin with the weapon out
			P.BodyRot.Yaw += T * 90.f;
			P.HandR = HandAt(75.f, R * 1.15f, 0.f);
			P.WeaponRot = FRotator(-10.f, 80.f, 0.f);
			break;
		case 2:  // fists up, weapon stowed at the hip
			P.HandR = FVector(R * 0.35f, R * 0.5f, BodyHeight * 0.55f);
			P.HandL = FVector(R * 0.35f, -R * 0.5f, BodyHeight * 0.55f);
			// Both fists are raised, so the weapon has no hand to sit in. It
			// used to default to the body's origin - Disc's chakram sat halfway
			// out of its chest and Cinder's bomb vanished inside it.
			P.WeaponLoc = HandAt(80.f, R * 1.1f, -BodyHeight * 0.25f);
			P.WeaponRot = FRotator(-60.f, 30.f, 0.f);
			break;
		default:  // weapon planted forward, heroic lean
			P.HandR = FVector(R * 0.95f, R * 0.2f, -BodyHeight * 0.25f);
			P.WeaponRot = FRotator(-70.f, 0.f, 0.f);
			P.BodyRot.Pitch += 6.f;
			break;
		}
		if (Flavour != 2)
		{
			P.WeaponLoc = P.HandR;
		}
		break;
	}

	case EMoteFighterState::Idle:
	default:
		BuildIdlePose(S, P);
		// Weapon rests in the right hand, angled back and down.
		P.WeaponLoc = P.HandR;
		P.WeaponRot = FRotator(-18.f, 40.f, 0.f);
		break;
	}

	// ---- weapon holds -------------------------------------------------------
	switch (Hold)
	{
	case EMoteWeaponHold::TwoHanded:
	{
		// Left hand further up the shaft.
		const FVector Along = P.WeaponRot.Vector() * (WeaponReach * 0.24f);
		P.HandL = P.WeaponLoc + Along;
		break;
	}
	case EMoteWeaponHold::BowLeft:
	{
		// Bow's two melee jabs - Jab1 Bow Swipe (BowBash) and Jab2 Limb Strike
		// (SlashLeft) - are authored as RIGHT-handed sweeps, because SweepWeapon is
		// shared with the five fighters that swing from the right hand. The bow is
		// held in the LEFT hand, so re-parking it here left the right fist sweeping
		// empty air while the bow stood upright. Mirror the whole sweep across the
		// fighter's forward axis instead: the bow hand swings, the other one guards.
		const bool bBowMelee = (S.State == EMoteFighterState::Attacking)
			&& (S.MoveAnim == EMoteMoveAnim::BowBash || S.MoveAnim == EMoteMoveAnim::SlashLeft);
		if (bBowMelee)
		{
			// Reflecting in the fighter's XZ plane negates Y, yaw and roll; pitch survives.
			const FVector Swing(P.HandR.X, -P.HandR.Y, P.HandR.Z);
			P.HandR = FVector(P.HandL.X, -P.HandL.Y, P.HandL.Z);
			P.HandL = Swing;
			P.WeaponLoc = P.HandL;
			P.WeaponRot = FRotator(P.WeaponRot.Pitch, -P.WeaponRot.Yaw, -P.WeaponRot.Roll);
			P.BodyRot.Yaw = -P.BodyRot.Yaw;
		}
		else if (S.MoveAnim != EMoteMoveAnim::DrawBow || S.State != EMoteFighterState::Attacking)
		{
			// Bow carried upright in the left hand.
			P.WeaponLoc = P.HandL;
			P.WeaponRot = FRotator(90.f, 0.f, 0.f);
		}
		break;
	}
	case EMoteWeaponHold::Gauntlets:
		P.bWeaponVisible = false;
		break;
	default:
		break;
	}

	// Hands point their knuckles the way they are travelling.
	P.HandRRot = FRotator(0.f, FMath::RadiansToDegrees(FMath::Atan2(P.HandR.Y, P.HandR.X)) * 0.5f, 0.f);
	P.HandLRot = FRotator(0.f, FMath::RadiansToDegrees(FMath::Atan2(P.HandL.Y, P.HandL.X)) * 0.5f, 0.f);
}

// ---------------------------------------------------------------------------
//  Frame update
// ---------------------------------------------------------------------------

void UMoteAnimator::UpdatePose(const FMoteAnimState& S, float DeltaSeconds)
{
	if (!BodyPivot || !GauntletL || !GauntletR || !WeaponPivot)
	{
		return;
	}
	const float Dt = FMath::Clamp(DeltaSeconds, 0.f, 0.1f);

	FMotePose P;
	BuildPose(S, P);

	// Hitstop: freeze the pose but add a vibration so the frame still reads as violent.
	if (S.bInHitstop)
	{
		const float Amp = (S.bHitstopVictim ? 5.5f : 2.5f);
		const float Jitter = FMath::Sin(S.Time * 180.f) * Amp;
		P.BodyOffset.Y += Jitter;
		P.HandR.Y += Jitter;
		P.HandL.Y -= Jitter;
	}

	// Smooth between frames so state changes don't pop. Attacks snap; idle drifts.
	const bool bSnappy = (S.State == EMoteFighterState::Attacking || S.State == EMoteFighterState::Hitstun
		|| S.State == EMoteFighterState::Dodging);
	const float Blend = bInitialised ? 1.f - FMath::Exp(-(bSnappy ? 45.f : 16.f) * Dt) : 1.f;
	bInitialised = true;

	SmoothedBodyOffset = FMath::Lerp(SmoothedBodyOffset, P.BodyOffset, Blend);
	SmoothedBodyScale = FMath::Lerp(SmoothedBodyScale, P.BodyScale, Blend);
	SmoothedBodyRot = FMath::Lerp(SmoothedBodyRot, P.BodyRot, Blend);
	SmoothedHandR = FMath::Lerp(SmoothedHandR, P.HandR, Blend);
	SmoothedHandL = FMath::Lerp(SmoothedHandL, P.HandL, Blend);
	SmoothedWeaponLoc = FMath::Lerp(SmoothedWeaponLoc, P.WeaponLoc, Blend);
	SmoothedWeaponRot = FMath::Lerp(SmoothedWeaponRot, P.WeaponRot, Blend);

	BodyPivot->SetRelativeLocation(SmoothedBodyOffset);
	BodyPivot->SetRelativeScale3D(SmoothedBodyScale);

	// Spin is applied here, on top of the smoothed pose, rather than baked into
	// it: an FRotator lerp always takes the short way round, and a vector lerp
	// across a half-turn chord would drag the fists through the torso. Both
	// turned multi-turn sweeps into a static "arms out" pose.
	const FRotator SpinRot(0.f, P.SpinYaw, 0.f);
	const bool bSpin = !FMath::IsNearlyZero(P.SpinYaw);

	BodyPivot->SetRelativeRotation(bSpin ? SmoothedBodyRot + SpinRot : SmoothedBodyRot);

	const FVector HandR = bSpin ? SmoothedHandR.RotateAngleAxis(P.SpinYaw, FVector::UpVector) : SmoothedHandR;
	const FVector HandL = bSpin ? SmoothedHandL.RotateAngleAxis(P.SpinYaw, FVector::UpVector) : SmoothedHandL;
	GauntletR->SetRelativeLocation(HandR + GauntletOffsetR);
	GauntletL->SetRelativeLocation(HandL + GauntletOffsetL);
	GauntletR->SetRelativeRotation(P.HandRRot + SpinRot);
	GauntletL->SetRelativeRotation(P.HandLRot + SpinRot);

	WeaponPivot->SetRelativeLocation(bSpin
		? SmoothedWeaponLoc.RotateAngleAxis(P.SpinYaw, FVector::UpVector) : SmoothedWeaponLoc);
	WeaponPivot->SetRelativeRotation(SmoothedWeaponRot + SpinRot);

	if (WeaponMesh)
	{
		const bool bHide = !P.bWeaponVisible;
		if (WeaponMesh->bHiddenInGame != bHide)
		{
			WeaponMesh->SetHiddenInGame(bHide);
		}
	}

	bTrailWanted = P.bTrail && P.bTrailSource;
}

void UMoteAnimator::GetTrailSegment(FVector& OutBase, FVector& OutTip) const
{
	const FTransform T = WeaponPivot ? WeaponPivot->GetComponentTransform() : FTransform::Identity;
	if (Hold == EMoteWeaponHold::Gauntlets)
	{
		const FVector Fist = GauntletR ? GauntletR->GetComponentLocation() : T.GetLocation();
		OutBase = Fist;
		OutTip = Fist + (GauntletR ? GauntletR->GetForwardVector() : FVector::ForwardVector) * 26.f;
		return;
	}
	OutBase = T.TransformPosition(FVector(WeaponReach * 0.28f, 0.f, 0.f));
	OutTip = T.TransformPosition(FVector(WeaponReach, 0.f, 0.f));
}

FVector UMoteAnimator::GetStrikePoint() const
{
	if (Hold == EMoteWeaponHold::Gauntlets)
	{
		return GauntletR ? GauntletR->GetComponentLocation() : FVector::ZeroVector;
	}
	const FTransform T = WeaponPivot ? WeaponPivot->GetComponentTransform() : FTransform::Identity;
	return T.TransformPosition(FVector(WeaponReach * 0.85f, 0.f, 0.f));
}
