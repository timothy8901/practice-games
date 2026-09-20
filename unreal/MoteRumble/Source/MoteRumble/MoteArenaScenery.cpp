// Copyright Not Tim Games. All Rights Reserved.
//
// "Skyreach": the look of the arena. The fighting disc itself is gameplay
// (MoteArena.cpp); everything here is dressing and never collides.

#include "MoteArena.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"

namespace
{
	const TCHAR* PlatformMeshPath = TEXT("/Game/Art/Arena/SM_Arena_Platform.SM_Arena_Platform");
	const TCHAR* IslandMeshPath = TEXT("/Game/Art/Arena/SM_Sky_Island.SM_Sky_Island");
	const TCHAR* CrystalMeshPath = TEXT("/Game/Art/Arena/SM_Crystal_Cluster.SM_Crystal_Cluster");
	const TCHAR* PillarMeshPath = TEXT("/Game/Art/Arena/SM_Ruined_Pillar.SM_Ruined_Pillar");
	const TCHAR* BrazierMeshPath = TEXT("/Game/Art/Arena/SM_Brazier.SM_Brazier");
	const TCHAR* SpherePath = TEXT("/Engine/BasicShapes/Sphere.Sphere");
	const TCHAR* AdditivePath = TEXT("/Game/FX/M_FX_Additive.M_FX_Additive");
	const TCHAR* BasicMatPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");

	constexpr int32 EmberCount = 90;

	UStaticMesh* Load(const TCHAR* Path)
	{
		return LoadObject<UStaticMesh>(nullptr, Path, nullptr, LOAD_Quiet | LOAD_NoWarn);
	}

	/**
	 * Height of the platform's walkable deck in mesh space. The bounding box top
	 * is the railing, not the floor, so find the highest vertex that still sits
	 * out near the full radius of the disc - that is the deck surface.
	 */
	float FindDeckTop(UStaticMesh* Mesh)
	{
		const FBox Box = Mesh->GetBoundingBox();
		const float Fallback = Box.Max.Z;
		const FStaticMeshRenderData* RenderData = Mesh->GetRenderData();
		if (!RenderData || RenderData->LODResources.Num() == 0)
		{
			return Fallback;
		}
		const FPositionVertexBuffer& Positions = RenderData->LODResources[0].VertexBuffers.PositionVertexBuffer;
		const uint32 Count = Positions.GetNumVertices();
		if (Count == 0)
		{
			return Fallback;
		}
		const float MaxRadius = FMath::Max(Box.GetSize().X, Box.GetSize().Y) * 0.5f;
		float DeckTop = -BIG_NUMBER;
		for (uint32 i = 0; i < Count; ++i)
		{
			const FVector P(Positions.VertexPosition(i));
			const float Radius = FVector2D(P.X, P.Y).Size();
			// Out near the edge of the disc, but not the thin railing posts.
			if (Radius > MaxRadius * 0.55f && Radius < MaxRadius * 0.97f)
			{
				DeckTop = FMath::Max(DeckTop, static_cast<float>(P.Z));
			}
		}
		return (DeckTop > -BIG_NUMBER) ? DeckTop : Fallback;
	}

	/** Deterministic pseudo-random so the stage looks the same every match. */
	float Hash01(int32 Seed)
	{
		const float S = FMath::Sin(Seed * 12.9898f) * 43758.5453f;
		return S - FMath::FloorToFloat(S);
	}

	float HashRange(int32 Seed, float Min, float Max)
	{
		return FMath::Lerp(Min, Max, Hash01(Seed));
	}
}

void AMoteArena::BuildScenery()
{
	UStaticMesh* Sphere = Load(SpherePath);
	UMaterialInterface* Additive = LoadObject<UMaterialInterface>(nullptr, AdditivePath, nullptr, LOAD_Quiet | LOAD_NoWarn);
	UMaterialInterface* Basic = LoadObject<UMaterialInterface>(nullptr, BasicMatPath, nullptr, LOAD_Quiet | LOAD_NoWarn);
	UMaterialInterface* GlowMat = Additive ? Additive : Basic;

	auto AddMesh = [this](UStaticMesh* Mesh, const FVector& Loc, const FRotator& Rot, const FVector& Scale)
		-> UStaticMeshComponent*
	{
		if (!Mesh)
		{
			return nullptr;
		}
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
		C->SetupAttachment(Root);
		C->SetStaticMesh(Mesh);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		C->SetGenerateOverlapEvents(false);
		C->RegisterComponent();
		C->SetRelativeLocation(Loc);
		C->SetRelativeRotation(Rot);
		C->SetRelativeScale3D(Scale);
		SceneryMeshes.Add(C);
		SceneryBaseTransforms.Add(FTransform(Rot, Loc, Scale));
		SceneryBobPhase.Add(Hash01(SceneryMeshes.Num() * 7 + 3) * 2.f * PI);
		return C;
	};

	auto AddLight = [this](const FVector& Loc, const FLinearColor& Color, float Intensity, float Radius)
	{
		UPointLightComponent* L = NewObject<UPointLightComponent>(this);
		L->SetupAttachment(Root);
		L->RegisterComponent();
		L->SetRelativeLocation(Loc);
		L->SetLightColor(Color);
		L->SetIntensityUnits(ELightUnits::Candelas);
		L->SetIntensity(Intensity);
		L->SetAttenuationRadius(Radius);
		L->SetCastShadows(false);
		SceneryLights.Add(L);
	};

	// ---- the fighting platform -------------------------------------------
	// Fit the art so its flat top lands exactly on Z = 0 and its walkable
	// radius matches the collision disc.
	if (UStaticMesh* PlatformArt = Load(PlatformMeshPath))
	{
		PlatformMesh->SetStaticMesh(PlatformArt);
		PlatformMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

		const FBox Box = PlatformArt->GetBoundingBox();
		const FVector Size = Box.GetSize();
		const float ArtRadius = FMath::Max(Size.X, Size.Y) * 0.5f;
		// The sculpt's rim overhangs the walkable area a little; allow for it.
		const float Scale = (PlatformRadius * 1.04f) / FMath::Max(ArtRadius, 1.f);
		PlatformMesh->SetRelativeScale3D(FVector(Scale));
		// Sink it so the walkable deck - not the railing - lands on Z = 0.
		const float DeckZ = FindDeckTop(PlatformArt) * Scale;
		const FVector Centre = Box.GetCenter() * Scale;
		PlatformMesh->SetRelativeLocation(FVector(-Centre.X, -Centre.Y, -DeckZ));
		// The collision disc is now purely functional.
		Floor->SetVisibility(false);
	}
	else if (UMaterialInstanceDynamic* MID = Floor->CreateAndSetMaterialInstanceDynamic(0))
	{
		MID->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.78f, 0.70f, 0.58f));
	}

	// ---- the rock the platform is perched on ------------------------------
	// The sculpted deck is a thin disc, so hang an upside-down sky island under
	// it: instant floating-rock underside with matching stone texture.
	UStaticMesh* IslandArt = Load(IslandMeshPath);
	if (IslandArt)
	{
		const FBox IB = IslandArt->GetBoundingBox();
		const float IslandRadius = FMath::Max(IB.GetSize().X, IB.GetSize().Y) * 0.5f;
		const float UnderScale = (PlatformRadius * 0.92f) / FMath::Max(IslandRadius, 1.f);
		AddMesh(IslandArt, FVector(0.f, 0.f, -110.f), FRotator(180.f, 0.f, 0.f), FVector(UnderScale, UnderScale, UnderScale * 1.5f));
		// Not scenery that bobs: pin it in place.
		SceneryBaseTransforms.Last() = FTransform(FRotator(180.f, 0.f, 0.f), FVector(0.f, 0.f, -110.f),
			FVector(UnderScale, UnderScale, UnderScale * 1.5f));
		SceneryBobPhase.Last() = 0.f;
		bUnderRockIndex = SceneryMeshes.Num() - 1;
	}

	// ---- distant floating islands ----------------------------------------
	UStaticMesh* Island = IslandArt;
	UStaticMesh* Pillar = Load(PillarMeshPath);
	UStaticMesh* Crystal = Load(CrystalMeshPath);
	UStaticMesh* Brazier = Load(BrazierMeshPath);

	constexpr int32 IslandCount = 13;
	for (int32 i = 0; i < IslandCount; ++i)
	{
		// Keep the camera's side (-X) clear so nothing blocks the fight.
		const float Angle = FMath::DegreesToRadians(HashRange(i * 13 + 1, -105.f, 105.f));
		const float Dist = HashRange(i * 17 + 5, 5200.f, 15500.f);
		const float Height = HashRange(i * 23 + 9, -2600.f, 1500.f);
		const float Size = HashRange(i * 29 + 11, 6.f, 22.f);
		const FVector Loc(FMath::Cos(Angle) * Dist, FMath::Sin(Angle) * Dist, Height);
		UStaticMeshComponent* IslandComp = AddMesh(Island, Loc, FRotator(0.f, HashRange(i * 31 + 2, 0.f, 360.f), 0.f), FVector(Size));
		if (!IslandComp)
		{
			continue;
		}

		// Dress the nearer islands with ruins and crystals.
		if (Dist < 11000.f)
		{
			const float Top = Height + Size * 60.f;
			if (Hash01(i * 37 + 3) > 0.45f)
			{
				AddMesh(Pillar, FVector(Loc.X + HashRange(i * 41, -400.f, 400.f), Loc.Y + HashRange(i * 43, -400.f, 400.f), Top),
					FRotator(HashRange(i * 47, -6.f, 6.f), HashRange(i * 53, 0.f, 360.f), 0.f), FVector(HashRange(i * 59, 3.f, 7.f)));
			}
			if (Hash01(i * 61 + 7) > 0.5f)
			{
				const FVector CrystalLoc(Loc.X + HashRange(i * 67, -500.f, 500.f), Loc.Y + HashRange(i * 71, -500.f, 500.f), Top);
				AddMesh(Crystal, CrystalLoc, FRotator(0.f, HashRange(i * 73, 0.f, 360.f), 0.f), FVector(HashRange(i * 79, 3.f, 6.f)));
				AddLight(CrystalLoc + FVector(0.f, 0.f, 200.f), FLinearColor(0.25f, 0.85f, 0.95f), 900.f, 2600.f);
			}
		}
	}

	// ---- braziers on small rocks just outside the rim ---------------------
	for (int32 i = 0; i < 4; ++i)
	{
		const float Angle = FMath::DegreesToRadians(35.f + i * 90.f);
		const FVector Base(FMath::Cos(Angle) * (PlatformRadius + 420.f), FMath::Sin(Angle) * (PlatformRadius + 420.f), -190.f);
		AddMesh(Brazier, Base, FRotator(0.f, HashRange(i * 83, 0.f, 360.f), 0.f), FVector(1.5f));

		// A flame: two additive blobs that flicker in TickScenery.
		const FVector FlameLoc = Base + FVector(0.f, 0.f, 120.f);
		for (int32 f = 0; f < 2; ++f)
		{
			UStaticMeshComponent* Flame = NewObject<UStaticMeshComponent>(this);
			Flame->SetupAttachment(Root);
			Flame->SetStaticMesh(Sphere);
			Flame->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			Flame->SetCastShadow(false);
			Flame->RegisterComponent();
			Flame->SetRelativeLocation(FlameLoc + FVector(0.f, 0.f, f * 40.f));
			Flame->SetRelativeScale3D(FVector(0.5f - f * 0.16f, 0.5f - f * 0.16f, 0.75f - f * 0.2f));
			if (UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(GlowMat, this))
			{
				MID->SetVectorParameterValue(TEXT("Color"), f == 0 ? FLinearColor(1.f, 0.45f, 0.12f) : FLinearColor(1.f, 0.8f, 0.3f));
				MID->SetScalarParameterValue(TEXT("Intensity"), 1.6f);
				MID->SetScalarParameterValue(TEXT("Opacity"), 0.8f);
				MID->SetScalarParameterValue(TEXT("RimPower"), 1.6f);
				Flame->SetMaterial(0, MID);
			}
			Flames.Add(Flame);
			FlameBase.Add(Flame->GetRelativeLocation());
		}
		AddLight(FlameLoc + FVector(0.f, 0.f, 40.f), FLinearColor(1.f, 0.55f, 0.2f), 900.f, 1200.f);
		FlameLights.Add(SceneryLights.Last());
	}

	// ---- embers drifting around the arena ---------------------------------
	if (Sphere)
	{
		Embers = NewObject<UInstancedStaticMeshComponent>(this);
		Embers->SetupAttachment(Root);
		Embers->SetStaticMesh(Sphere);
		Embers->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Embers->SetCastShadow(false);
		Embers->RegisterComponent();
		if (UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(GlowMat, this))
		{
			MID->SetVectorParameterValue(TEXT("Color"), FLinearColor(1.f, 0.72f, 0.35f));
			MID->SetScalarParameterValue(TEXT("Intensity"), 3.f);
			MID->SetScalarParameterValue(TEXT("Opacity"), 0.85f);
			MID->SetScalarParameterValue(TEXT("RimPower"), 1.4f);
			Embers->SetMaterial(0, MID);
		}
		EmberVelocities.Reserve(EmberCount);
		for (int32 i = 0; i < EmberCount; ++i)
		{
			const float Angle = HashRange(i * 3 + 1, 0.f, 2.f * PI);
			const float Dist = HashRange(i * 5 + 2, 200.f, PlatformRadius * 1.25f);
			const FVector Loc(FMath::Cos(Angle) * Dist, FMath::Sin(Angle) * Dist, HashRange(i * 7 + 3, -260.f, 900.f));
			const float S = HashRange(i * 11 + 4, 0.035f, 0.1f);
			Embers->AddInstance(FTransform(FRotator::ZeroRotator, Loc, FVector(S)));
			EmberVelocities.Add(FVector(HashRange(i * 13, -9.f, 9.f), HashRange(i * 17, -9.f, 9.f), HashRange(i * 19, 12.f, 46.f)));
		}
	}
}

void AMoteArena::TickScenery(float DeltaSeconds)
{
	// Islands bob and turn very slowly.
	for (int32 i = 0; i < SceneryMeshes.Num(); ++i)
	{
		UStaticMeshComponent* C = SceneryMeshes[i];
		if (!C || !SceneryBaseTransforms.IsValidIndex(i) || i == bUnderRockIndex)
		{
			continue;
		}
		const FTransform& Base = SceneryBaseTransforms[i];
		const float Phase = SceneryBobPhase.IsValidIndex(i) ? SceneryBobPhase[i] : 0.f;
		const float Bob = FMath::Sin(SceneryTime * 0.25f + Phase) * 55.f;
		C->SetRelativeLocation(Base.GetLocation() + FVector(0.f, 0.f, Bob));
		C->SetRelativeRotation(FRotator(Base.Rotator().Pitch, Base.Rotator().Yaw + SceneryTime * 0.35f, Base.Rotator().Roll));
	}

	// Flames flicker in size and light.
	for (int32 i = 0; i < Flames.Num(); ++i)
	{
		UStaticMeshComponent* Flame = Flames[i];
		if (!Flame || !FlameBase.IsValidIndex(i))
		{
			continue;
		}
		const float F = 0.82f + 0.18f * FMath::Sin(SceneryTime * (9.f + i) + i * 1.7f)
			+ 0.08f * FMath::Sin(SceneryTime * 23.f + i);
		const FVector S = (i % 2 == 0) ? FVector(0.5f, 0.5f, 0.75f) : FVector(0.34f, 0.34f, 0.55f);
		Flame->SetRelativeScale3D(S * F);
		Flame->SetRelativeLocation(FlameBase[i] + FVector(0.f, 0.f, (F - 1.f) * 40.f));
	}
	for (int32 i = 0; i < FlameLights.Num(); ++i)
	{
		if (UPointLightComponent* L = FlameLights[i])
		{
			L->SetIntensity(800.f + 260.f * FMath::Sin(SceneryTime * (11.f + i * 0.7f)));
		}
	}

	// Embers drift upward and wrap around.
	if (Embers && EmberVelocities.Num() == Embers->GetInstanceCount())
	{
		for (int32 i = 0; i < Embers->GetInstanceCount(); ++i)
		{
			FTransform T;
			Embers->GetInstanceTransform(i, T, false);
			FVector Loc = T.GetLocation();
			const FVector& V = EmberVelocities[i];
			Loc += V * DeltaSeconds;
			Loc.X += FMath::Sin(SceneryTime * 0.7f + i) * 6.f * DeltaSeconds;
			if (Loc.Z > 1100.f)
			{
				Loc.Z = -300.f;
			}
			T.SetLocation(Loc);
			Embers->UpdateInstanceTransform(i, T, false, i == Embers->GetInstanceCount() - 1, false);
		}
	}
}
