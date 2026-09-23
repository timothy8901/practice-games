// Copyright Not Tim Games. All Rights Reserved.
//
// Arena gameplay: the walkable disc, blast zones, spawn points and respawn
// halos. The look of the place lives in MoteArenaScenery.cpp.

#include "MoteArena.h"

#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	const TCHAR* CylinderPath = TEXT("/Engine/BasicShapes/Cylinder.Cylinder");
	const TCHAR* BasicMaterialPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");
	const TCHAR* AdditivePath = TEXT("/Game/FX/M_FX_Additive.M_FX_Additive");
	constexpr float FloorThickness = 60.f;
}

AMoteArena::AMoteArena()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderFinder(CylinderPath);
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BasicFinder(BasicMaterialPath);

	// The engine cylinder is 100 across and 100 tall, centred on its origin.
	Floor = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Floor"));
	Floor->SetupAttachment(Root);
	if (CylinderFinder.Succeeded())
	{
		Floor->SetStaticMesh(CylinderFinder.Object);
	}
	if (BasicFinder.Succeeded())
	{
		Floor->SetMaterial(0, BasicFinder.Object);
	}
	Floor->SetCollisionProfileName(TEXT("BlockAll"));
	Floor->SetCastShadow(true);

	PlatformMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PlatformMesh"));
	PlatformMesh->SetupAttachment(Root);
	PlatformMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void AMoteArena::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	// Top of the disc sits exactly at Z = 0.
	Floor->SetRelativeScale3D(FVector(PlatformRadius * 2.f / 100.f, PlatformRadius * 2.f / 100.f, FloorThickness / 100.f));
	Floor->SetRelativeLocation(FVector(0.f, 0.f, -FloorThickness * 0.5f));
}

void AMoteArena::BeginPlay()
{
	Super::BeginPlay();
	Floor->SetRelativeScale3D(FVector(PlatformRadius * 2.f / 100.f, PlatformRadius * 2.f / 100.f, FloorThickness / 100.f));
	Floor->SetRelativeLocation(FVector(0.f, 0.f, -FloorThickness * 0.5f));
	BuildScenery();
}

void AMoteArena::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	SceneryTime += DeltaSeconds;

	// Respawn halos slowly turn and pulse.
	for (int32 i = 0; i < RespawnHalos.Num(); ++i)
	{
		if (UStaticMeshComponent* Halo = RespawnHalos[i])
		{
			if (Halo->IsVisible())
			{
				Halo->AddLocalRotation(FRotator(0.f, 60.f * DeltaSeconds, 0.f));
			}
		}
	}

	TickScenery(DeltaSeconds);
}

bool AMoteArena::IsOutsideBlastZone(const FVector& Location) const
{
	const FVector Local = Location - GetActorLocation();
	return Local.Size2D() > BlastSideRadius || Local.Z > BlastTop || Local.Z < BlastBottom;
}

bool AMoteArena::IsOverPlatform(const FVector& Location, float Margin) const
{
	const FVector Local = Location - GetActorLocation();
	return Local.Size2D() <= PlatformRadius + Margin;
}

void AMoteArena::GetSpawnPoint(int32 Index, int32 Count, FVector& OutLocation, float& OutYaw) const
{
	// The gameplay camera looks down +X, so fighters line up left/right (Y).
	const float Spread = PlatformRadius * 0.45f;
	if (Count <= 2)
	{
		const float Side = (Index == 0) ? -1.f : 1.f;
		OutLocation = GetActorLocation() + FVector(0.f, Side * Spread, 140.f);
		OutYaw = (Index == 0) ? 90.f : -90.f;
		return;
	}
	const float Angle = 2.f * PI * Index / Count + PI;
	OutLocation = GetActorLocation() + FVector(FMath::Cos(Angle) * Spread, FMath::Sin(Angle) * Spread, 140.f);
	OutYaw = FMath::RadiansToDegrees(Angle) + 180.f;
}

FVector AMoteArena::GetRespawnPoint(int32 Index, int32 Count) const
{
	const float Side = (Count <= 2) ? ((Index == 0) ? -1.f : 1.f) : ((Index % 2 == 0) ? -1.f : 1.f);
	return GetActorLocation() + FVector(0.f, Side * PlatformRadius * 0.28f, 760.f);
}

void AMoteArena::ShowRespawnHalo(int32 Slot, const FVector& Location, const FLinearColor& Color, bool bShow)
{
	if (Slot < 0 || Slot > 7)
	{
		return;
	}
	// Created on demand at runtime.
	while (RespawnHalos.Num() <= Slot)
	{
		UStaticMeshComponent* Halo = NewObject<UStaticMeshComponent>(this);
		Halo->SetupAttachment(Root);
		Halo->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, CylinderPath));
		Halo->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Halo->SetCastShadow(false);
		Halo->SetRelativeScale3D(FVector(1.9f, 1.9f, 0.06f));
		Halo->RegisterComponent();
		Halo->SetVisibility(false);

		UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, AdditivePath, nullptr, LOAD_Quiet | LOAD_NoWarn);
		if (!Mat)
		{
			Mat = LoadObject<UMaterialInterface>(nullptr, BasicMaterialPath);
		}
		Halo->SetMaterial(0, UMaterialInstanceDynamic::Create(Mat, this));
		RespawnHalos.Add(Halo);

		UPointLightComponent* Light = NewObject<UPointLightComponent>(this);
		Light->SetupAttachment(Halo);
		Light->SetCastShadows(false);
		Light->SetIntensityUnits(ELightUnits::Candelas);
		Light->SetIntensity(80.f);
		Light->SetAttenuationRadius(600.f);
		Light->RegisterComponent();
		Light->SetVisibility(false);
		RespawnLights.Add(Light);
	}

	UStaticMeshComponent* Halo = RespawnHalos[Slot];
	UPointLightComponent* Light = RespawnLights[Slot];
	Halo->SetVisibility(bShow);
	Light->SetVisibility(bShow);
	if (!bShow)
	{
		return;
	}
	Halo->SetWorldLocation(Location);
	Light->SetLightColor(Color);
	if (UMaterialInstanceDynamic* MID = Cast<UMaterialInstanceDynamic>(Halo->GetMaterial(0)))
	{
		MID->SetVectorParameterValue(TEXT("Color"), Color);
		MID->SetScalarParameterValue(TEXT("Intensity"), 6.f);
		MID->SetScalarParameterValue(TEXT("Opacity"), 0.85f);
		MID->SetScalarParameterValue(TEXT("RimPower"), 0.f);
	}
}
