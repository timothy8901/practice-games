// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MoteTypes.h"
#include "MoteAnimator.generated.h"

struct FMoteAnimState;
class UStaticMeshComponent;

/** One frame of choreography, in the fighter's VisualRoot space. */
struct FMotePose
{
	FVector BodyOffset = FVector::ZeroVector;
	FRotator BodyRot = FRotator::ZeroRotator;
	FVector BodyScale = FVector::OneVector;

	FVector HandR = FVector::ZeroVector;
	FVector HandL = FVector::ZeroVector;
	FRotator HandRRot = FRotator::ZeroRotator;
	FRotator HandLRot = FRotator::ZeroRotator;

	/** Weapon grip transform: the business end points along +X. */
	FVector WeaponLoc = FVector::ZeroVector;
	FRotator WeaponRot = FRotator::ZeroRotator;
	bool bWeaponVisible = true;
	/** This frame should leave a weapon trail. */
	bool bTrail = false;
	/** There is something in hand to trail FROM. Distinct from bWeaponVisible,
	 *  which is about the weapon mesh: Flare's weapon IS its gauntlets. */
	bool bTrailSource = true;

	/** Raw winding angle for spin moves, applied AFTER smoothing so a
	 *  multi-turn sweep is not collapsed to the shortest path. */
	float SpinYaw = 0.f;
};

/**
 * Procedural animation for a Mote. There are no skeletons in this game: a Mote
 * is a floating body, two detached gauntlets and a weapon, and this component
 * choreographs all four every frame from FMoteAnimState.
 *
 * SPACE CONVENTIONS (all relative to the fighter's VisualRoot component):
 *   +X forward (the way the fighter faces), +Y the fighter's RIGHT, +Z up, cm.
 *   The VisualRoot sits at the capsule centre raised by the hover height, so the
 *   body's centre is at the origin. The body is ~BodyHeight tall.
 *
 * WHAT IT DRIVES (relative transforms under VisualRoot):
 *   BodyPivot   - bob, lean, squash & stretch, tumble spin, attack twist.
 *   GauntletL/R - the hands. The right hand is at +Y. The LEFT gauntlet mesh is
 *                 mirrored by the fighter (negative Y scale); keep |scale| as given.
 *   WeaponPivot - the weapon's grip point. The weapon mesh is mounted so its
 *                 business end points along the pivot's +X and the grip is at the
 *                 pivot origin. Hands should sit ON the grip while holding it
 *                 (TwoHanded: left hand further along +X by ~22% of WeaponReach;
 *                 BowLeft: the bow is held in the LEFT hand with its long axis
 *                 vertical and the right hand draws back).
 *
 * The fighter owns gameplay; this component only ever writes transforms (and
 * weapon visibility for BombRight after a throw). It must never move the actor.
 */
UCLASS(ClassGroup = (Mote), meta = (BlueprintSpawnableComponent))
class MOTERUMBLE_API UMoteAnimator : public UActorComponent
{
	GENERATED_BODY()

public:
	UMoteAnimator();

	/**
	 * Bind the pieces to animate. Called by the fighter whenever its fighter
	 * definition (and so its meshes) changes.
	 */
	void Initialize(USceneComponent* InBodyPivot, UStaticMeshComponent* InGauntletL,
		UStaticMeshComponent* InGauntletR, USceneComponent* InWeaponPivot,
		UStaticMeshComponent* InWeaponMesh, const FMoteFighterDef& Def, float InBodyHeight, float InWeaponReach,
		float InFloorZ = -96.f);

	/**
	 * Pose everything for this frame. Called by the fighter at the end of its
	 * Tick with real (unfrozen) delta time, so hitstop shakes still animate.
	 */
	void UpdatePose(const FMoteAnimState& State, float DeltaSeconds);

	/** True while a weapon swing should leave a trail. */
	bool WantsTrail() const { return bTrailWanted; }
	bool WantsWeaponVisible() const { return bWeaponVisibleWanted; }

	/** World-space ends of the weapon's cutting edge this frame (for trails). */
	void GetTrailSegment(FVector& OutBase, FVector& OutTip) const;

	/** World-space point where the current strike lands (weapon tip or leading fist). */
	FVector GetStrikePoint() const;

protected:
	/** Distance the hands float out from the body's centre. */
	float HandRadius() const;
	void BuildIdlePose(const FMoteAnimState& State, FMotePose& Pose) const;
	void BuildAttackPose(const FMoteAnimState& State, FMotePose& Pose) const;
	void BuildPose(const FMoteAnimState& State, FMotePose& Pose) const;

	UPROPERTY() TObjectPtr<USceneComponent> BodyPivot;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> GauntletL;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> GauntletR;
	UPROPERTY() TObjectPtr<USceneComponent> WeaponPivot;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> WeaponMesh;

	EMoteWeaponHold Hold = EMoteWeaponHold::OneHandRight;
	EMoteCore Core = EMoteCore::Blade;
	float BodyHeight = 130.f;
	float WeaponReach = 150.f;
	FVector GauntletScaleL = FVector::OneVector;
	FVector GauntletScaleR = FVector::OneVector;
	/** FitMesh's bounds-centring offset, which posing must preserve or the
	 *  fist renders off the grip. */
	FVector GauntletOffsetL = FVector::ZeroVector;
	/** Last pose's bWeaponVisible, so code that also touches the weapon mesh
	 *  can respect the animation instead of overriding it. */
	bool bWeaponVisibleWanted = true;
	FVector GauntletOffsetR = FVector::ZeroVector;
	bool bTrailWanted = false;

	// ---- inter-frame smoothing ----
	bool bInitialised = false;
	/** The deck's height in VisualRoot space while grounded, so poses that swing
	 *  a weapon down can aim it AT the floor instead of through it. */
	float FloorZ = -96.f;
	/** Spin bookkeeping: what was left of an interrupted turn, unwinding. */
	float LastSpinYaw = 0.f;
	float SpinResidual = 0.f;
	FVector SmoothedBodyOffset = FVector::ZeroVector;
	FVector SmoothedBodyScale = FVector::OneVector;
	FRotator SmoothedBodyRot = FRotator::ZeroRotator;
	FVector SmoothedHandR = FVector::ZeroVector;
	FVector SmoothedHandL = FVector::ZeroVector;
	FVector SmoothedWeaponLoc = FVector::ZeroVector;
	FRotator SmoothedWeaponRot = FRotator::ZeroRotator;

	// Implementation state (smoothing, springs, previous poses) lives here.
	// The implementer is free to add members below this line.
};
