// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "MoteTypes.h"
#include "MoteCharacter.generated.h"

class UStaticMeshComponent;
class UPointLightComponent;
class UMaterialInstanceDynamic;
class UMoteAnimator;
class UMoteWeaponTrail;
class AMoteProjectile;

/**
 * Everything the procedural animator needs to pose a fighter this frame.
 * Filled by AMoteCharacter::GetAnimState(); read-only for everyone else.
 */
struct FMoteAnimState
{
	EMoteFighterState State = EMoteFighterState::Idle;
	/** Seconds spent in the current State. */
	float StateTime = 0.f;

	// ---- attacking ----
	EMoteMoveSlot MoveSlot = EMoteMoveSlot::Jab1;
	EMoteMoveAnim MoveAnim = EMoteMoveAnim::SlashRight;
	EMoteMovePhase Phase = EMoteMovePhase::None;
	/** 0..1 through the current phase. */
	float PhaseAlpha = 0.f;
	/** 0..1 through the whole move (Startup+Active+Recovery; charging holds it at 0). */
	float MoveAlpha = 0.f;
	/** 0..1 of the move's MaxCharge. */
	float Charge01 = 0.f;
	/** Which combo hit this is (0,1,2) - lets the animator alternate sides. */
	int32 ComboIndex = 0;

	// ---- locomotion ----
	FVector Velocity = FVector::ZeroVector;
	/** Horizontal speed as a fraction of run speed. */
	float Speed01 = 0.f;
	bool bGrounded = true;
	bool bHovering = false;
	/** Seconds since the last jump (ground or air); large when not recently. */
	float TimeSinceJump = 99.f;
	float TimeSinceLanded = 99.f;
	int32 AirJumpsUsed = 0;

	// ---- defence / damage ----
	float Shield01 = 1.f;
	FVector DodgeDirection = FVector::ZeroVector;
	/** Seconds left in hitstun, and whether it is a tumble (strong launch). */
	float HitstunRemaining = 0.f;
	bool bTumble = false;
	FVector LaunchDirection = FVector::ZeroVector;
	/** In hitstop (frozen on impact) - the animator adds a shake. */
	bool bInHitstop = false;
	bool bHitstopVictim = false;
	/** Seconds since the last time this fighter was hit. */
	float TimeSinceHurt = 99.f;

	/** Monotonic world time for idle cycles (unaffected by hitstop freezes). */
	float Time = 0.f;
};

/**
 * A Mote: a limbless floating spirit knight with two detached gauntlets and an
 * oversized weapon. Movement is a CharacterMovementComponent; everything else -
 * moves, hitboxes, knockback, shield, dodge - is implemented here.
 *
 * Driven through the "button" API below by either AMotePlayerController or
 * AMoteAIController. Move input is WORLD-space XY (the controller converts from
 * camera space).
 */
UCLASS()
class MOTERUMBLE_API AMoteCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AMoteCharacter();

	virtual void Tick(float DeltaSeconds) override;
	virtual void Landed(const FHitResult& Hit) override;

	// ---- Setup -----------------------------------------------------------------

	/** Become this fighter: swaps meshes, stats and moves. */
	void SetFighter(EMoteCore NewCore);
	EMoteCore GetCore() const { return Core; }
	const FMoteFighterDef& GetFighterDef() const;

	/** Player slot (0 = P1). Drives HUD colour and the default facing. */
	void SetPlayerIndex(int32 Index) { PlayerIndex = Index; }
	int32 GetPlayerIndex() const { return PlayerIndex; }
	void SetIsCPU(bool bCPU) { bIsCPU = bCPU; }
	bool IsCPU() const { return bIsCPU; }

	// ---- Button API (player controller / AI) -----------------------------------

	/** World-space XY direction, magnitude 0..1. Must be re-sent every frame. */
	void SetMoveInput(const FVector2D& WorldDir);
	void PressJump();
	void SetJumpHeld(bool bHeld);
	void PressLight();
	void PressHeavy();
	void ReleaseHeavy();
	void SetShieldHeld(bool bHeld);
	/** Roll (ground) or air dodge in the current move-input direction. */
	void PressDodge();

	// ---- Match flow --------------------------------------------------------------

	/** Place on the stage in a fresh state (match start). */
	void ResetForMatch(const FVector& Location, float Yaw);
	/** Put on the respawn halo; it drops onto the stage when released. */
	void BeginRespawn(const FVector& HaloLocation, float Yaw);
	/** Blast-zone crossing: hide, zero velocity, enter KO. The game mode decides what happens next. */
	void EnterKO();
	void SetInactive();
	void EnterVictory();
	/** Freeze/unfreeze all input (countdowns, pauses). */
	void SetControlsLocked(bool bLocked) { bControlsLocked = bLocked; }

	// ---- Combat ------------------------------------------------------------------

	EMoteHitResult TakeHit(const FMoteHitInfo& Hit);

	/** Smash knockback formula for this victim at its current percent (after Damage is added). */
	float ComputeKnockback(const FMoteHitInfo& Hit, float PercentAfter) const;

	/** Freeze this fighter for Seconds (hitstop). */
	void ApplyHitstop(float Seconds, bool bAsVictim);

	/** Projectiles call this back when they connect so combos/stats can credit the owner. */
	void NotifyLandedHit(AMoteCharacter* Victim, float Damage);

	// ---- Queries (HUD, AI, camera) ------------------------------------------------

	EMoteFighterState GetFighterState() const { return State; }
	float GetPercent() const { return Percent; }
	int32 GetStocks() const { return Stocks; }
	void SetStocks(int32 In) { Stocks = In; }
	bool IsKO() const { return State == EMoteFighterState::KO; }
	bool IsActiveInMatch() const { return State != EMoteFighterState::KO && State != EMoteFighterState::Inactive; }
	bool IsInvulnerable() const { return InvulnTimer > 0.f || State == EMoteFighterState::Respawning; }
	bool IsGrounded() const;
	bool IsAttacking() const { return State == EMoteFighterState::Attacking; }
	bool IsShielding() const { return State == EMoteFighterState::Shielding; }
	bool IsInHitstun() const { return State == EMoteFighterState::Hitstun; }
	bool IsCharging() const { return State == EMoteFighterState::Attacking && Phase == EMoteMovePhase::Charging; }
	float GetShield01() const { return ShieldHP / MoteTuning::ShieldMax; }
	int32 GetAirJumpsLeft() const;
	float GetHoverLeft() const { return HoverLeft; }
	/** The move in progress (valid only while attacking). */
	const FMoteMoveDef* GetCurrentMove() const;
	EMoteMovePhase GetMovePhase() const { return Phase; }
	float GetPhaseTime() const { return PhaseTime; }
	/** Horizontal facing (unit XY). */
	FVector GetFacing() const;
	/** Seconds since this fighter last took a hit (for combo counters/AI). */
	float GetTimeSinceHurt() const { return TimeSinceHurt; }
	/** Consecutive hits landed on the current victim without them escaping (combo counter). */
	int32 GetComboCount() const { return ComboCount; }
	AMoteCharacter* GetLastAttacker() const { return LastAttacker.Get(); }
	FLinearColor GetAccent() const;

	// ---- Stats for the results screen -----------------------------------------------
	float StatDamageDealt = 0.f;
	int32 StatKOs = 0;
	int32 StatFalls = 0;
	float StatMaxCombo = 0.f;

	FMoteAnimState GetAnimState() const;

	/** Visual attach points for FX (world space). */
	FVector GetWeaponTipLocation() const;
	FVector GetCoreLocation() const;

	/** Weapon mesh/pivot, exposed for the animator and trails. */
	USceneComponent* GetWeaponPivot() const { return WeaponPivot; }
	UStaticMeshComponent* GetWeaponMeshComponent() const { return WeaponMesh; }
	UStaticMeshComponent* GetGauntletL() const { return GauntletL; }
	UStaticMeshComponent* GetGauntletR() const { return GauntletR; }
	UStaticMeshComponent* GetBodyMeshComponent() const { return BodyMesh; }
	/** Length of the mounted weapon along +X from the pivot (for trails/tips). */
	float GetWeaponReach() const { return WeaponReach; }

protected:
	virtual void BeginPlay() override;

	// ---- internals -----------------------------------------------------------------
	void TickTimers(float Dt);
	void TickMovement(float Dt);
	void TickAttack(float Dt);
	void TickShield(float Dt);
	void TickDodge(float Dt);
	void TickHitstun(float Dt);
	void TickPresentation(float Dt, float RealDt);

	void SetState(EMoteFighterState NewState);
	bool CanAct() const;
	void StartMove(EMoteMoveSlot Slot);
	void EnterPhase(EMoteMovePhase NewPhase);
	void OnMoveActive();
	void ResolveHitbox(float DamageScale, bool bFinalHit, int32 HitIndex);
	void ResolveLandingHit();
	void EmitProjectiles(float ChargeScale);
	void ReflectProjectiles();
	void EndMove();
	float CurrentChargeScale() const;

	void DoJump(bool bAir);
	void StartDodge(const FVector& Dir);
	void BreakShield();
	void Launch(const FVector& Velocity, float HitstunSeconds, bool bTumble);
	/** Simulates the launch to see if it leaves the blast zone. */
	bool PredictLethal(const FVector& StartLocation, const FVector& Velocity) const;

	void ApplyFighterVisuals();
	void FitMesh(UStaticMeshComponent* Comp, UStaticMesh* Mesh, float TargetSize, bool bUseHeight);
	void MountWeapon(UStaticMesh* Mesh);
	void UpdateOverlay(float RealDt);
	void PlaySfx(FName Sound, float Volume = 1.f, float PitchJitter = 0.06f) const;

	// ---- components -----------------------------------------------------------------

	/** Everything visual hangs off here; offset up by the hover height. */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<USceneComponent> VisualRoot;
	/** Squash/stretch/tilt pivot for the body (driven by the animator). */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<USceneComponent> BodyPivot;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UStaticMeshComponent> BodyMesh;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UStaticMeshComponent> GauntletL;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UStaticMeshComponent> GauntletR;
	/** Grip point of the weapon; the animator poses this, the hands follow. */
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<USceneComponent> WeaponPivot;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UStaticMeshComponent> WeaponMesh;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UStaticMeshComponent> ShieldBubble;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UPointLightComponent> CoreLight;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UMoteAnimator> Animator;
	UPROPERTY(VisibleAnywhere, Category = "Mote|Visual") TObjectPtr<UMoteWeaponTrail> Trail;

	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> OverlayMID;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> ShieldMID;

	// ---- identity -----------------------------------------------------------------------
	EMoteCore Core = EMoteCore::Blade;
	int32 PlayerIndex = 0;
	bool bIsCPU = false;
	bool bVisualsApplied = false;

	/** Hover height of the visual root above the capsule bottom. */
	float HoverHeight = 30.f;
	float WeaponReach = 150.f;

	// ---- state ----------------------------------------------------------------------------
	EMoteFighterState State = EMoteFighterState::Inactive;
	float StateTime = 0.f;
	float Percent = 0.f;
	int32 Stocks = MoteTuning::DefaultStocks;
	bool bControlsLocked = false;

	// Input
	FVector2D MoveInput = FVector2D::ZeroVector;
	bool bJumpHeld = false;
	bool bHeavyHeld = false;
	bool bShieldHeld = false;
	/** Buffered presses (seconds left) so inputs just before an action ends still count. */
	float BufferLight = 0.f;
	float BufferHeavy = 0.f;
	float BufferJump = 0.f;
	float BufferDodge = 0.f;

	// Move
	EMoteMoveSlot MoveSlot = EMoteMoveSlot::Jab1;
	EMoteMovePhase Phase = EMoteMovePhase::None;
	float PhaseTime = 0.f;
	float ChargeTime = 0.f;
	int32 HitsDone = 0;
	int32 ComboIndex = 0;
	bool bComboQueued = false;
	TArray<TWeakObjectPtr<AMoteCharacter>> HitThisSwing;
	FVector MoveFacing = FVector::ForwardVector;

	// Air
	int32 AirJumpsUsed = 0;
	float HoverLeft = 0.f;
	bool bHovering = false;
	bool bAirDodgeUsed = false;
	float TimeSinceJump = 99.f;
	float TimeSinceLanded = 99.f;
	bool bWasGrounded = true;

	// Defence
	float ShieldHP = MoteTuning::ShieldMax;
	float DodgeTimer = 0.f;
	float DodgeDuration = 0.f;
	FVector DodgeDir = FVector::ZeroVector;
	float InvulnTimer = 0.f;
	float ShieldStunTimer = 0.f;

	// Damage
	float HitstunTimer = 0.f;
	bool bTumble = false;
	FVector LaunchVel = FVector::ZeroVector;
	float HitstopTimer = 0.f;
	bool bHitstopVictim = false;
	float TimeSinceHurt = 99.f;
	float FlashTimer = 0.f;
	float SmokeTimer = 0.f;
	TWeakObjectPtr<AMoteCharacter> LastAttacker;
	int32 ComboCount = 0;
	TWeakObjectPtr<AMoteCharacter> ComboVictim;

	float WorldTime = 0.f;
	float RespawnHoldTimer = 0.f;
	FVector RespawnHalo = FVector::ZeroVector;
};
