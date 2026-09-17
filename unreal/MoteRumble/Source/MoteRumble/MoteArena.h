// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MoteArena.generated.h"

class UStaticMeshComponent;
class UBoxComponent;

/**
 * The duelling ground: a circular platform with a decorative pillar ring and
 * invisible containment walls.
 *
 * Built procedurally from engine primitives so the game is fully playable in
 * an empty level - no .umap authoring required to get something on screen.
 */
UCLASS()
class MOTERUMBLE_API AMoteArena : public AActor
{
	GENERATED_BODY()

public:
	AMoteArena();

	/** Playable radius; fighters are walled in just past this. */
	UPROPERTY(EditAnywhere, Category = "Arena")
	float ArenaRadius = 1750.f;

	UPROPERTY(EditAnywhere, Category = "Arena")
	int32 PillarCount = 14;

	UPROPERTY(EditAnywhere, Category = "Arena")
	int32 WallSegments = 24;

	float GetArenaRadius() const { return ArenaRadius; }

protected:
	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

	/** Lays out floor, pillars, and walls. Safe to call repeatedly. */
	void BuildArena();

	UPROPERTY(VisibleAnywhere, Category = "Arena")
	TObjectPtr<USceneComponent> ArenaRoot;

	UPROPERTY(VisibleAnywhere, Category = "Arena")
	TObjectPtr<UStaticMeshComponent> Floor;

	/** Inner accent disc, purely visual. */
	UPROPERTY(VisibleAnywhere, Category = "Arena")
	TObjectPtr<UStaticMeshComponent> InnerDisc;

	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> Pillars;

	UPROPERTY()
	TArray<TObjectPtr<UBoxComponent>> Walls;

private:
	bool bBuilt = false;
};
