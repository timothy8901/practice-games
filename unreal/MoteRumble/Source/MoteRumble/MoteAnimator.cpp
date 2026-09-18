// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full procedural animation implementation.

#include "MoteAnimator.h"
#include "MoteCharacter.h"
#include "Components/StaticMeshComponent.h"

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
	BodyHeight = InBodyHeight;
	WeaponReach = InWeaponReach;
}

void UMoteAnimator::UpdatePose(const FMoteAnimState& S, float DeltaSeconds)
{
	if (!BodyPivot || !GauntletL || !GauntletR || !WeaponPivot)
	{
		return;
	}
	const float Bob = FMath::Sin(S.Time * 2.6f) * 5.f;
	BodyPivot->SetRelativeLocation(FVector(0.f, 0.f, Bob));
	const FVector R(20.f, BodyHeight * 0.55f, -10.f + Bob * 0.5f);
	const FVector L(20.f, -BodyHeight * 0.55f, -10.f - Bob * 0.5f);
	GauntletR->SetRelativeLocation(R);
	GauntletL->SetRelativeLocation(L);
	float Swing = 0.f;
	bTrailWanted = false;
	if (S.State == EMoteFighterState::Attacking)
	{
		Swing = FMath::Lerp(60.f, -90.f, S.MoveAlpha);
		bTrailWanted = S.Phase == EMoteMovePhase::Active;
	}
	WeaponPivot->SetRelativeLocation(R);
	WeaponPivot->SetRelativeRotation(FRotator(-20.f, Swing, 0.f));
}

void UMoteAnimator::GetTrailSegment(FVector& OutBase, FVector& OutTip) const
{
	const FTransform T = WeaponPivot ? WeaponPivot->GetComponentTransform() : FTransform::Identity;
	OutBase = T.TransformPosition(FVector(WeaponReach * 0.3f, 0.f, 0.f));
	OutTip = T.TransformPosition(FVector(WeaponReach, 0.f, 0.f));
}

FVector UMoteAnimator::GetStrikePoint() const
{
	const FTransform T = WeaponPivot ? WeaponPivot->GetComponentTransform() : FTransform::Identity;
	return T.TransformPosition(FVector(WeaponReach, 0.f, 0.f));
}
