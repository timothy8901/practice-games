// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MoteArena.generated.h"

class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class UPointLightComponent;

/**
 * "Skyreach" - the floating battle platform and everything around it.
 *
 * Gameplay (MoteArena.cpp): a flat circular walkable disc of PlatformRadius with
 * its top at Z = 0 and open edges; blast zones (a vertical cylinder of
 * BlastSideRadius from Z = BlastBottom to Z = BlastTop). Leave it and you're KO'd.
 *
 * Scenery (MoteArenaScenery.cpp): the Thrixel platform mesh fitted over the
 * collision disc, distant floating islands, pillars, crystal clusters, braziers
 * with fire and warm lights, ambient drifting embers/dust, and the respawn halo.
 * Scenery never collides with fighters.
 */
UCLASS()
class MOTERUMBLE_API AMoteArena : public AActor
{
	GENERATED_BODY()

public:
	AMoteArena();

	virtual void Tick(float DeltaSeconds) override;

	float GetPlatformRadius() const { return PlatformRadius; }
	float GetBlastSideRadius() const { return BlastSideRadius; }
	float GetBlastTop() const { return BlastTop; }
	float GetBlastBottom() const { return BlastBottom; }

	bool IsOutsideBlastZone(const FVector& Location) const;
	/** Is this XY above the walkable disc? */
	bool IsOverPlatform(const FVector& Location, float Margin = 0.f) const;
	/** Start position for fighter Index of Count, facing the centre. */
	void GetSpawnPoint(int32 Index, int32 Count, FVector& OutLocation, float& OutYaw) const;
	/** Where the respawn halo appears for fighter Index. */
	FVector GetRespawnPoint(int32 Index, int32 Count) const;

	/** Show/hide the glowing respawn halo platform at a location. */
	void ShowRespawnHalo(int32 Slot, const FVector& Location, const FLinearColor& Color, bool bShow);

protected:
	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

	/** Implemented in MoteArenaScenery.cpp. Called once from BeginPlay. */
	void BuildScenery();
	/** Implemented in MoteArenaScenery.cpp. Animates bobbing islands, flames, embers. */
	void TickScenery(float DeltaSeconds);

	// ---- gameplay ----
	UPROPERTY(EditAnywhere, Category = "Arena") float PlatformRadius = 850.f;
	UPROPERTY(EditAnywhere, Category = "Arena") float BlastSideRadius = 2900.f;
	UPROPERTY(EditAnywhere, Category = "Arena") float BlastTop = 2600.f;
	UPROPERTY(EditAnywhere, Category = "Arena") float BlastBottom = -1700.f;

	UPROPERTY(VisibleAnywhere) TObjectPtr<USceneComponent> Root;
	/** Invisible flat collision disc the fighters stand on. */
	UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> Floor;

	// ---- scenery (owned by MoteArenaScenery.cpp) ----
	UPROPERTY(VisibleAnywhere) TObjectPtr<UStaticMeshComponent> PlatformMesh;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> RespawnHalos;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> RespawnLights;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> SceneryMeshes;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> SceneryLights;
	UPROPERTY() TObjectPtr<UInstancedStaticMeshComponent> Embers;

	float SceneryTime = 0.f;

	// ---- scenery implementation state ----
	TArray<FTransform> SceneryBaseTransforms;
	TArray<float> SceneryBobPhase;
	TArray<FVector> EmberVelocities;
	UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Flames;
	TArray<FVector> FlameBase;
	UPROPERTY() TArray<TObjectPtr<UPointLightComponent>> FlameLights;
	/** Scenery that must stay put: the rock under the deck, and the braziers,
	 *  whose flames are separate components that do not bob with them. */
	TSet<int32> StillScenery;
};
