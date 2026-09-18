// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MoteTypes.h"
#include "MoteAnimator.generated.h"

struct FMoteAnimState;
class UStaticMeshComponent;

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
		UStaticMeshComponent* InWeaponMesh, const FMoteFighterDef& Def, float InBodyHeight, float InWeaponReach);

	/**
	 * Pose everything for this frame. Called by the fighter at the end of its
	 * Tick with real (unfrozen) delta time, so hitstop shakes still animate.
	 */
	void UpdatePose(const FMoteAnimState& State, float DeltaSeconds);

	/** True while a weapon swing should leave a trail. */
	bool WantsTrail() const { return bTrailWanted; }

	/** World-space ends of the weapon's cutting edge this frame (for trails). */
	void GetTrailSegment(FVector& OutBase, FVector& OutTip) const;

	/** World-space point where the current strike lands (weapon tip or leading fist). */
	FVector GetStrikePoint() const;

protected:
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
	bool bTrailWanted = false;

	// Implementation state (smoothing, springs, previous poses) lives here.
	// The implementer is free to add members below this line.
};
