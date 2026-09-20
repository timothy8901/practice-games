// Copyright Not Tim Games. All Rights Reserved.
//
// The camera. Frames every fighter Smash-style, shakes on impacts, and handles
// the cinematic modes. Everything here runs on REAL time so slow-motion and
// hitstop stay smooth.

#include "MoteCameraDirector.h"

#include "MoteArena.h"
#include "MoteCharacter.h"
#include "MoteEvents.h"
#include "MoteGameMode.h"

#include "Camera/CameraComponent.h"
#include "Misc/App.h"

namespace
{
	/** The gameplay camera always looks this way down the world X axis. */
	constexpr float GameplayYaw = 0.f;
	constexpr float MinDistance = 1650.f;
	constexpr float MaxDistance = 5600.f;
	constexpr float MinPitch = -38.f;
	constexpr float MaxPitch = -24.f;
	constexpr float FieldOfView = 52.f;

	/** Critically damped spring toward a target. */
	template <typename T>
	void Spring(T& Value, T& Velocity, const T& Target, float Stiffness, float Dt)
	{
		const float Damping = 2.f * FMath::Sqrt(Stiffness);
		const T Accel = (Target - Value) * Stiffness - Velocity * Damping;
		Velocity += Accel * Dt;
		Value += Velocity * Dt;
	}

	float Noise1D(float T, int32 Seed)
	{
		// Cheap smooth pseudo-noise in [-1,1].
		const float X = T * 1.7f + Seed * 37.13f;
		return FMath::Sin(X) * 0.6f + FMath::Sin(X * 2.37f + 1.3f) * 0.3f + FMath::Sin(X * 5.11f + 2.7f) * 0.1f;
	}
}

AMoteCameraDirector::AMoteCameraDirector()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PostPhysics;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	RootComponent = Camera;
	Camera->SetFieldOfView(FieldOfView);
	Camera->bConstrainAspectRatio = false;
}

void AMoteCameraDirector::BeginPlay()
{
	Super::BeginPlay();

	CurrentFocus = FVector(0.f, 0.f, 260.f);
	CurrentDistance = 3000.f;
	CurrentPitch = -34.f;
	CurrentYaw = GameplayYaw;

	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		HitHandle = Hub->OnHit.AddUObject(this, &AMoteCameraDirector::OnHit);
		KOHandle = Hub->OnKO.AddUObject(this, &AMoteCameraDirector::OnKO);
		ImpactHandle = Hub->OnImpact.AddLambda([this](const FVector&, float Strength)
		{
			AddTrauma(FMath::Clamp(Strength * 0.22f, 0.f, 0.6f));
		});
	}
}

void AMoteCameraDirector::EndPlay(const EEndPlayReason::Type Reason)
{
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->OnHit.Remove(HitHandle);
		Hub->OnKO.Remove(KOHandle);
		Hub->OnImpact.Remove(ImpactHandle);
	}
	Super::EndPlay(Reason);
}

void AMoteCameraDirector::SetMode(EMoteCamMode NewMode, AActor* InFocus)
{
	if (Mode != NewMode)
	{
		ModeTime = 0.f;
	}
	Mode = NewMode;
	Focus = InFocus;
}

void AMoteCameraDirector::AddTrauma(float Amount)
{
	Trauma = FMath::Clamp(Trauma + Amount, 0.f, 1.f);
}

void AMoteCameraDirector::Kick(const FVector& WorldDirection, float Strength)
{
	KickOffset += WorldDirection.GetSafeNormal() * Strength;
}

float AMoteCameraDirector::GetViewYaw() const
{
	return (Mode == EMoteCamMode::Gameplay || Mode == EMoteCamMode::Intro) ? GameplayYaw : CurrentYaw;
}

void AMoteCameraDirector::OnHit(const FMoteHitEvent& Event)
{
	if (Event.bBlocked)
	{
		AddTrauma(0.05f);
		return;
	}
	const float Amount = FMath::Clamp(Event.Knockback / 140.f, 0.06f, 0.7f) * (Event.bStrong ? 1.4f : 1.f);
	AddTrauma(Amount);
	Kick(Event.LaunchVelocity.GetSafeNormal(), FMath::Clamp(Event.Knockback * 0.5f, 10.f, 90.f));
	if (Event.bLethal)
	{
		AddTrauma(0.5f);
	}
	// A punch of FOV on the meaty ones.
	FovKick = FMath::Max(FovKick, FMath::Clamp(Event.Knockback / 200.f, 0.f, 1.f) * 4.f);
}

void AMoteCameraDirector::OnKO(const FMoteKOEvent& Event)
{
	AddTrauma(Event.bFinal ? 1.f : 0.75f);
	Kick(-Event.InwardDirection, 120.f);
}

// ---------------------------------------------------------------------------

void AMoteCameraDirector::GatherTargets(TArray<FVector>& OutPoints, AMoteGameMode*& OutGM) const
{
	OutGM = GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
	if (!OutGM)
	{
		return;
	}
	const AMoteArena* Arena = OutGM->GetArena();
	for (AMoteCharacter* F : OutGM->GetFighters())
	{
		if (!F || !F->IsActiveInMatch())
		{
			continue;
		}
		const FVector P = F->GetActorLocation();
		if (Arena && Arena->IsOutsideBlastZone(P))
		{
			continue;
		}
		OutPoints.Add(P);
	}
}

void AMoteCameraDirector::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Real time: slow-mo must not slow the camera down.
	const float Dt = FMath::Clamp(static_cast<float>(FApp::GetDeltaTime()), 1.f / 240.f, 0.1f);
	ModeTime += Dt;

	AMoteGameMode* GM = nullptr;
	TArray<FVector> Points;
	GatherTargets(Points, GM);
	const AMoteArena* Arena = GM ? GM->GetArena() : nullptr;
	const float PlatformR = Arena ? Arena->GetPlatformRadius() : 1500.f;

	FVector TargetFocus(0.f, 0.f, 240.f);
	float TargetDistance = 3000.f;
	float TargetPitch = -34.f;
	float TargetYaw = GameplayYaw;
	float Stiffness = 42.f;

	switch (Mode)
	{
	case EMoteCamMode::Title:
	{
		// Slow heroic orbit that drifts in and out.
		const float Orbit = ModeTime * 6.5f;
		TargetYaw = FMath::Fmod(Orbit, 360.f);
		TargetFocus = FVector(0.f, 0.f, 260.f + 60.f * FMath::Sin(ModeTime * 0.23f));
		TargetDistance = 3100.f + 500.f * FMath::Sin(ModeTime * 0.17f);
		TargetPitch = -22.f + 7.f * FMath::Sin(ModeTime * 0.13f);
		Stiffness = 14.f;
		break;
	}

	case EMoteCamMode::Select:
	{
		// Close hero shot of whoever is under the cursor, from slightly below.
		const AActor* F = Focus.Get();
		const FVector At = F ? F->GetActorLocation() : FVector(0.f, 0.f, 120.f);
		TargetFocus = At + FVector(0.f, 0.f, 40.f);
		TargetDistance = 470.f;
		TargetPitch = -6.f + 3.f * FMath::Sin(ModeTime * 0.5f);
		TargetYaw = 180.f + 7.f * FMath::Sin(ModeTime * 0.35f);
		Stiffness = 26.f;
		break;
	}

	case EMoteCamMode::Intro:
	{
		// Sweep from a wide dramatic angle into the gameplay framing.
		const float A = FMath::Clamp(ModeTime / 2.4f, 0.f, 1.f);
		const float E = 1.f - FMath::Pow(1.f - A, 3.f);
		TargetFocus = FMath::Lerp(FVector(0.f, 0.f, 700.f), FVector(0.f, 0.f, 240.f), E);
		TargetDistance = FMath::Lerp(5000.f, 2900.f, E);
		TargetPitch = FMath::Lerp(-13.f, -33.f, E);
		TargetYaw = FMath::Lerp(-55.f, GameplayYaw, E);
		Stiffness = 30.f;
		break;
	}

	case EMoteCamMode::FinalHit:
	{
		const AActor* F = Focus.Get();
		const FVector At = F ? F->GetActorLocation() : FVector::ZeroVector;
		TargetFocus = At + FVector(0.f, 0.f, 60.f);
		TargetDistance = 620.f;
		TargetPitch = -12.f;
		TargetYaw = GameplayYaw - 26.f;
		Stiffness = 70.f;
		break;
	}

	case EMoteCamMode::Victory:
	{
		const AActor* F = Focus.Get();
		const FVector At = F ? F->GetActorLocation() : FVector(0.f, 0.f, 120.f);
		TargetFocus = At + FVector(0.f, 0.f, 50.f);
		TargetDistance = 560.f;
		TargetPitch = -8.f;
		TargetYaw = 180.f + ModeTime * 11.f;
		Stiffness = 20.f;
		break;
	}

	case EMoteCamMode::Gameplay:
	default:
	{
		// Frame every fighter, keep the stage in shot, zoom with their spread.
		FVector Centre(0.f, 0.f, 120.f);
		float SpreadY = PlatformR * 0.9f;
		float SpreadZ = 260.f;
		float LowestZ = 0.f;

		if (Points.Num() > 0)
		{
			FBox Box(ForceInit);
			for (const FVector& P : Points)
			{
				Box += P;
			}
			// Always keep a decent slice of the platform in frame.
			Box += FVector(0.f, -PlatformR * 0.42f, 0.f);
			Box += FVector(0.f, PlatformR * 0.42f, 0.f);
			Centre = Box.GetCenter();
			const FVector Extent = Box.GetExtent();
			SpreadY = FMath::Max(Extent.Y, 400.f);
			SpreadZ = FMath::Max(Extent.Z, 220.f);
			LowestZ = Box.Min.Z;
		}

		// Fit horizontally (FOV is horizontal in UE) and vertically (16:9-ish).
		const float HalfH = FMath::DegreesToRadians(FieldOfView * 0.5f);
		const float NeedH = (SpreadY + 300.f) / FMath::Tan(HalfH);
		const float HalfV = FMath::Atan(FMath::Tan(HalfH) * 0.5625f);
		const float NeedV = (SpreadZ + 300.f) / FMath::Tan(HalfV);
		TargetDistance = FMath::Clamp(FMath::Max(NeedH, NeedV), MinDistance, MaxDistance);

		// Leave room for the HUD panels and follow fighters knocked below the stage.
		TargetFocus = Centre + FVector(0.f, 0.f, 120.f);
		if (LowestZ < -300.f)
		{
			TargetFocus.Z = FMath::Min(TargetFocus.Z, LowestZ + 700.f);
		}
		// Keep the stage itself in shot: bias the focus back toward the middle
		// so a fight at the rim never leaves us staring at empty sky.
		TargetFocus.X = FMath::Clamp(TargetFocus.X * 0.75f, -PlatformR * 0.55f, PlatformR * 0.55f);
		TargetFocus.Y = FMath::Clamp(TargetFocus.Y * 0.9f, -PlatformR * 1.1f, PlatformR * 1.1f);
		TargetFocus.Z = FMath::Max(TargetFocus.Z, -900.f);

		const float ZoomAlpha = FMath::GetMappedRangeValueClamped(
			FVector2D(MinDistance, MaxDistance), FVector2D(0.f, 1.f), TargetDistance);
		TargetPitch = FMath::Lerp(MinPitch, MaxPitch, 1.f - ZoomAlpha);
		TargetYaw = GameplayYaw;
		// Zoom out fast, in slowly - never lose sight of the action.
		Stiffness = (TargetDistance > CurrentDistance) ? 60.f : 26.f;
		break;
	}
	}

	if (bSnap)
	{
		bSnap = false;
		CurrentFocus = TargetFocus;
		CurrentDistance = TargetDistance;
		CurrentPitch = TargetPitch;
		CurrentYaw = TargetYaw;
		FocusVel = FVector::ZeroVector;
		DistanceVel = 0.f;
		PitchVel = 0.f;
		YawVel = 0.f;
	}
	else
	{
		Spring(CurrentFocus, FocusVel, TargetFocus, Stiffness, Dt);
		Spring(CurrentDistance, DistanceVel, TargetDistance, Stiffness, Dt);
		Spring(CurrentPitch, PitchVel, TargetPitch, 30.f, Dt);
		// Yaw wraps: spring on the shortest path.
		const float YawDelta = FMath::UnwindDegrees(TargetYaw - CurrentYaw);
		float Unwrapped = CurrentYaw + YawDelta;
		Spring(CurrentYaw, YawVel, Unwrapped, Stiffness, Dt);
	}

	// ---- shake ----
	Trauma = FMath::Max(0.f, Trauma - Dt * 1.8f);
	FovKick = FMath::Max(0.f, FovKick - Dt * 14.f);
	KickOffset *= FMath::Pow(0.0008f, Dt);

	const float Shake = Trauma * Trauma;
	const float ShakeTime = static_cast<float>(FApp::GetCurrentTime()) * 26.f;
	const FVector ShakeOffset(
		Noise1D(ShakeTime, 1) * 34.f * Shake,
		Noise1D(ShakeTime, 2) * 42.f * Shake,
		Noise1D(ShakeTime, 3) * 30.f * Shake);
	const FRotator ShakeRot(
		Noise1D(ShakeTime, 4) * 1.1f * Shake,
		Noise1D(ShakeTime, 5) * 1.3f * Shake,
		Noise1D(ShakeTime, 6) * 2.2f * Shake);

	// ---- place ----
	const FRotator Look(CurrentPitch, CurrentYaw, 0.f);
	const FVector Back = -Look.Vector();
	const FVector Location = CurrentFocus + Back * CurrentDistance + ShakeOffset + KickOffset;
	SetActorLocationAndRotation(Location, Look + ShakeRot);

	if (Camera)
	{
		Camera->SetFieldOfView(FieldOfView + FovKick);

		// Depth of field only in the cinematic moments.
		const bool bCinematic = (Mode == EMoteCamMode::FinalHit || Mode == EMoteCamMode::Victory || Mode == EMoteCamMode::Select);
		FPostProcessSettings PP;
		if (bCinematic)
		{
			PP.bOverride_DepthOfFieldFocalDistance = true;
			PP.DepthOfFieldFocalDistance = CurrentDistance;
			PP.bOverride_DepthOfFieldFstop = true;
			PP.DepthOfFieldFstop = 1.6f;
			PP.bOverride_DepthOfFieldSensorWidth = true;
			PP.DepthOfFieldSensorWidth = 42.f;
		}
		Camera->PostProcessSettings = PP;
		Camera->PostProcessBlendWeight = bCinematic ? 1.f : 0.f;
	}
}
