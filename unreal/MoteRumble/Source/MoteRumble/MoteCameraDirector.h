// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MoteCameraDirector.generated.h"

class UCameraComponent;
class AMoteCharacter;
struct FMoteHitEvent;
struct FMoteKOEvent;

UENUM(BlueprintType)
enum class EMoteCamMode : uint8
{
	Title,     // Slow cinematic orbit around the arena
	Select,    // Close, flattering 3/4 shot of the Focus fighter (the one under the cursor)
	Intro,     // Sweep in from wide to the gameplay framing over ~2.5 s
	Gameplay,  // Smash-style: frame every active fighter, zoom with their spread
	FinalHit,  // Snap close onto Focus (the victim of the game-winning hit)
	Victory    // Hero orbit around Focus (the winner)
};

/**
 * The only camera in the game. The game mode spawns it and makes it every
 * player's view target. It reads fighters and the arena from AMoteGameMode each
 * frame and listens to UMoteEventHub for impacts (shake/kick) and KOs.
 *
 * Gameplay framing is a fixed-yaw 3/4 view (looking along +X, i.e. the camera
 * sits on the -X side of the arena looking toward +X, pitched down ~30-40 deg)
 * so that "up" on the keyboard reliably means +X in the world. Distance/FOV
 * adapt to fit all active fighters plus a margin, clamped so the stage stays
 * readable. Motion is critically-damped and uses REAL (undilated) delta time so
 * slow-mo moments stay smooth.
 */
UCLASS()
class MOTERUMBLE_API AMoteCameraDirector : public AActor
{
	GENERATED_BODY()

public:
	AMoteCameraDirector();

	virtual void Tick(float DeltaSeconds) override;

	void SetMode(EMoteCamMode NewMode, AActor* InFocus = nullptr);
	EMoteCamMode GetMode() const { return Mode; }

	/** Add screen-shake trauma (0..1, accumulates, decays over ~0.5 s). */
	void AddTrauma(float Amount);
	/** A short directional positional kick (impacts). */
	void Kick(const FVector& WorldDirection, float Strength);
	/** Skip smoothing on the next update (hard cuts). */
	void SnapNextFrame() { bSnap = true; }

	/** Yaw of the gameplay camera: controllers use this to make input camera-relative. */
	float GetViewYaw() const;

	UCameraComponent* GetCamera() const { return Camera; }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	void OnHit(const FMoteHitEvent& Event);
	void OnKO(const FMoteKOEvent& Event);
	/** World positions the camera must keep in frame this tick. */
	void GatherTargets(TArray<FVector>& OutPoints, class AMoteGameMode*& OutGM) const;

	UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;

	EMoteCamMode Mode = EMoteCamMode::Title;
	TWeakObjectPtr<AActor> Focus;
	float ModeTime = 0.f;
	float Trauma = 0.f;
	bool bSnap = true;

	FDelegateHandle HitHandle;
	FDelegateHandle KOHandle;
	FDelegateHandle ImpactHandle;

	// ---- spring state ----
	FVector CurrentFocus = FVector::ZeroVector;
	FVector FocusVel = FVector::ZeroVector;
	float CurrentDistance = 3000.f;
	float DistanceVel = 0.f;
	float CurrentPitch = -34.f;
	float PitchVel = 0.f;
	float CurrentYaw = 0.f;
	float YawVel = 0.f;
	/** Directional impact punch, decays fast. */
	FVector KickOffset = FVector::ZeroVector;
	float FovKick = 0.f;
};
