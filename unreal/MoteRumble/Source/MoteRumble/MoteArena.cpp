// Copyright Not Tim Games. All Rights Reserved.

#include "MoteArena.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	// Warm stone platform, cool accent ring, gold pillar caps.
	static const FLinearColor FloorColor(0.86f, 0.78f, 0.72f);
	static const FLinearColor InnerColor(0.96f, 0.93f, 0.88f);
	static const FLinearColor PillarColor(0.58f, 0.76f, 0.70f);
}

AMoteArena::AMoteArena()
{
	PrimaryActorTick.bCanEverTick = false;

	ArenaRoot = CreateDefaultSubobject<USceneComponent>(TEXT("ArenaRoot"));
	RootComponent = ArenaRoot;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylMesh(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BaseMat(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));

	UStaticMesh* Cylinder = CylMesh.Succeeded() ? CylMesh.Object : nullptr;
	UMaterialInterface* Mat = BaseMat.Succeeded() ? BaseMat.Object : nullptr;

	Floor = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Floor"));
	Floor->SetupAttachment(ArenaRoot);
	if (Cylinder) { Floor->SetStaticMesh(Cylinder); }
	if (Mat) { Floor->SetMaterial(0, Mat); }
	Floor->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	Floor->SetCollisionProfileName(TEXT("BlockAll"));

	InnerDisc = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("InnerDisc"));
	InnerDisc->SetupAttachment(ArenaRoot);
	if (Cylinder) { InnerDisc->SetStaticMesh(Cylinder); }
	if (Mat) { InnerDisc->SetMaterial(0, Mat); }
	InnerDisc->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	// Pillars and walls are created up front so they exist on the CDO; their
	// transforms are laid out in BuildArena().
	Pillars.Reserve(PillarCount);
	for (int32 i = 0; i < PillarCount; ++i)
	{
		const FName Name = *FString::Printf(TEXT("Pillar_%d"), i);
		UStaticMeshComponent* P = CreateDefaultSubobject<UStaticMeshComponent>(Name);
		P->SetupAttachment(ArenaRoot);
		if (Cylinder) { P->SetStaticMesh(Cylinder); }
		if (Mat) { P->SetMaterial(0, Mat); }
		P->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
		P->SetCollisionProfileName(TEXT("BlockAll"));
		Pillars.Add(P);
	}

	Walls.Reserve(WallSegments);
	for (int32 i = 0; i < WallSegments; ++i)
	{
		const FName Name = *FString::Printf(TEXT("Wall_%d"), i);
		UBoxComponent* W = CreateDefaultSubobject<UBoxComponent>(Name);
		W->SetupAttachment(ArenaRoot);
		W->SetBoxExtent(FVector(40.f, 260.f, 400.f));
		W->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
		W->SetCollisionProfileName(TEXT("BlockAll"));
		W->SetHiddenInGame(true);
		Walls.Add(W);
	}
}

void AMoteArena::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	BuildArena();
}

void AMoteArena::BeginPlay()
{
	Super::BeginPlay();
	BuildArena();

	// Tint at runtime; the engine's basic material exposes a Color parameter.
	auto Tint = [](UStaticMeshComponent* Comp, const FLinearColor& C)
	{
		if (!Comp) { return; }
		if (UMaterialInstanceDynamic* MID = Comp->CreateAndSetMaterialInstanceDynamic(0))
		{
			MID->SetVectorParameterValue(TEXT("Color"), C);
		}
	};

	Tint(Floor, FloorColor);
	Tint(InnerDisc, InnerColor);
	for (UStaticMeshComponent* P : Pillars)
	{
		Tint(P, PillarColor);
	}
}

void AMoteArena::BuildArena()
{
	// Engine cylinder is 100uu across and 100uu tall at scale 1.
	const float FloorScaleXY = (ArenaRadius * 2.f) / 100.f;

	if (Floor)
	{
		Floor->SetRelativeLocation(FVector(0.f, 0.f, -20.f));
		Floor->SetRelativeScale3D(FVector(FloorScaleXY, FloorScaleXY, 0.40f));
	}

	if (InnerDisc)
	{
		const float InnerScale = (ArenaRadius * 1.25f) / 100.f;
		// A hair above the floor so it doesn't z-fight.
		InnerDisc->SetRelativeLocation(FVector(0.f, 0.f, 1.5f));
		InnerDisc->SetRelativeScale3D(FVector(InnerScale, InnerScale, 0.02f));
	}

	for (int32 i = 0; i < Pillars.Num(); ++i)
	{
		UStaticMeshComponent* P = Pillars[i];
		if (!P) { continue; }
		const float Angle = (2.f * PI * i) / FMath::Max(1, Pillars.Num());
		const float R = ArenaRadius + 90.f;
		P->SetRelativeLocation(FVector(FMath::Cos(Angle) * R, FMath::Sin(Angle) * R, 120.f));
		P->SetRelativeScale3D(FVector(0.85f, 0.85f, 2.6f));
	}

	for (int32 i = 0; i < Walls.Num(); ++i)
	{
		UBoxComponent* W = Walls[i];
		if (!W) { continue; }
		const int32 Count = FMath::Max(1, Walls.Num());
		const float Angle = (2.f * PI * i) / Count;
		const float R = ArenaRadius + 40.f;

		// Each segment is a chord of the circle, turned to face the centre.
		const float Circumference = 2.f * PI * R;
		const float SegmentHalfWidth = (Circumference / Count) * 0.62f;
		W->SetBoxExtent(FVector(40.f, SegmentHalfWidth, 400.f));
		W->SetRelativeLocation(FVector(FMath::Cos(Angle) * R, FMath::Sin(Angle) * R, 300.f));
		W->SetRelativeRotation(FRotator(0.f, FMath::RadiansToDegrees(Angle), 0.f));
	}

	bBuilt = true;
}
