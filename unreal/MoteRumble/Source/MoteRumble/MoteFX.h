// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Components/SceneComponent.h"
#include "MoteTypes.h"
#include "MoteFX.generated.h"

class UProceduralMeshComponent;
class UMaterialInstanceDynamic;

/**
 * All transient visual effects in Mote Rumble, built from meshes + the FX
 * materials authored by Tools/import_content.py (see DESIGN.md "FX materials").
 * No Niagara assets are required. Every call is fire-and-forget and cheap: the
 * subsystem pools its actors/components and animates them itself.
 *
 * Colours are linear. "Strength" is roughly 0..2 (0.3 a jab, 1 a strong hit,
 * 2 a KO-level smash). If an FX material is missing the effect must still
 * render with a sensible fallback (never crash, never log-spam).
 */
UCLASS()
class MOTERUMBLE_API UMoteFX : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	static UMoteFX* Get(const UObject* WorldContext);

	// ---- combat ----
	/** Impact burst: flash + sparks/streaks (+ ring for strong hits), styled per FX type. */
	void HitSpark(const FVector& Location, const FVector& Direction, EMoteFxType Type,
		const FLinearColor& Color, float Strength);
	/** Hit absorbed by a shield: glassy hex/bubble ripple. */
	void BlockSpark(const FVector& Location, const FLinearColor& Color);
	/**
	 * A big readable crescent swoosh drawn in the air for melee swings (on top of
	 * the weapon trail). Center = attacker centre; the arc spans ArcDegrees around
	 * Facing at Radius, sweeping clockwise (seen from above) when bRightToLeft.
	 */
	void SlashArc(const FVector& Center, const FRotator& Facing, float Radius, float ArcDegrees,
		const FLinearColor& Color, bool bRightToLeft, float Strength);
	/** Expanding ground ring (slams, landings of plunges, explosions). */
	void Shockwave(const FVector& Location, float Radius, const FLinearColor& Color, float Strength);
	void Explosion(const FVector& Location, float Radius);
	/** Telegraph circle on the floor before a lightning strike lands. */
	void LightningWarning(const FVector& GroundLocation, float Radius, float Duration, const FLinearColor& Color);
	/** Jagged bolt from the sky + flash + ring. */
	void Lightning(const FVector& GroundLocation, float Radius, const FLinearColor& Color);
	/** Short burst of flame travelling along Direction. */
	void FireBurst(const FVector& Location, const FVector& Direction, float Scale);
	/** Glittering motes gathering while a heavy charges. */
	void ChargeSparkle(const FVector& Location, const FLinearColor& Color, float Charge01);
	/** Spark ping when a charge reaches full. */
	void ChargeReady(const FVector& Location, const FLinearColor& Color);
	void ShieldBreak(const FVector& Location, const FLinearColor& Color);
	void Reflect(const FVector& Location, const FLinearColor& Color);

	// ---- movement ----
	void Dust(const FVector& GroundLocation, float Scale);
	/** Ring puff under a jump (bAir = mid-air jump, a floating magic ring). */
	void JumpPuff(const FVector& Location, const FLinearColor& Color, bool bAir);
	/** Smoke/streak puffs left behind a fighter launched hard. Called ~every 0.04s. */
	void LaunchSmoke(const FVector& Location, const FVector& Velocity, float Strength);
	/** Afterimage streak for dodges and dashes. */
	void DashStreak(const FVector& Location, const FVector& Direction, const FLinearColor& Color);

	// ---- match ----
	/** The star-KO blast: a huge coloured beam/column pointing back at the stage from the blast zone. */
	void KOBlast(const FVector& Location, const FVector& InwardDirection, const FLinearColor& Color);
	/** Pillar of light as a fighter reappears on the respawn halo. */
	void RespawnBeam(const FVector& Location, const FLinearColor& Color);

	// ---- projectiles ----
	/** Trailing glow puff for projectiles (called every ~0.03s by the projectile). */
	void ProjectileTrail(const FVector& Location, const FLinearColor& Color, float Size);

	// UTickableWorldSubsystem
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickableWhenPaused() const override { return false; }

protected:
	// Implementation (pools, live effect list, cached materials) is up to the implementer.
};

/**
 * Ribbon trail behind a swinging weapon. Owned by each fighter; the fighter
 * feeds it the weapon's base/tip each frame and toggles emission. Built on a
 * UProceduralMeshComponent with the M_FX_Ribbon material (additive, U = age
 * along the ribbon 0 at the head -> 1 at the tail, V = 0 at the base -> 1 at
 * the tip).
 */
UCLASS(ClassGroup = (Mote), meta = (BlueprintSpawnableComponent))
class MOTERUMBLE_API UMoteWeaponTrail : public USceneComponent
{
	GENERATED_BODY()

public:
	UMoteWeaponTrail();

	void SetColor(const FLinearColor& InColor);
	/** World-space sample: call every frame while the weapon moves. */
	void AddSample(const FVector& Base, const FVector& Tip);
	/** Stop adding new samples; existing ones fade out. */
	void SetEmitting(bool bInEmitting);
	/** Drop everything immediately (respawn, fighter swap). */
	void Clear();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType,
		FActorComponentTickFunction* ThisTickFunction) override;

protected:
	virtual void OnRegister() override;

	UPROPERTY() TObjectPtr<UProceduralMeshComponent> Mesh;
	UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> MID;

	FLinearColor Color = FLinearColor::White;
	bool bEmitting = false;

	// Implementation state (sample ring buffer etc.) is up to the implementer.
};
