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

	/** The platform's walkable deck, measured from the mesh itself, in mesh space. */
	struct FDeck
	{
		float Height = 0.f;
		float Radius = 1.f;
		FVector2D Centre = FVector2D::ZeroVector;
		bool bMeasured = false;
	};

	/**
	 * Find the walkable deck: its height, radius and centre.
	 *
	 * Measure area, not vertices. A flat cap is tessellated as a fan, so every
	 * one of its vertices sits out at the rim and there are none over the middle
	 * of the disc - scanning vertices in a radius band once missed the deck
	 * entirely, landed on a redundant inner face 10 units down, and buried the
	 * fighters to the waist.
	 *
	 * So walk the triangles: keep the horizontal, up-facing ones, total their
	 * footprint by height, and take the highest surface that is at least half as
	 * broad as the broadest one. That skips railings and lips (too small) and
	 * inner faces (not the highest) without special-casing any of them.
	 *
	 * Everything here comes from the deck, never from the bounding box. A
	 * sculpt's crystals and roots can hang out past the disc, and a box-based fit
	 * would then shrink the deck inside the collision disc - fighters standing on
	 * air at the edge - and pull it off centre.
	 */
	FDeck MeasureDeck(UStaticMesh* Mesh)
	{
		const FBox Box = Mesh->GetBoundingBox();
		FDeck Deck;
		Deck.Height = Box.Max.Z;
		Deck.Radius = FMath::Max(FMath::Max(Box.GetSize().X, Box.GetSize().Y) * 0.5f, 1.f);
		Deck.Centre = FVector2D(Box.GetCenter().X, Box.GetCenter().Y);

		const FStaticMeshRenderData* RenderData = Mesh->GetRenderData();
		if (!RenderData || RenderData->LODResources.Num() == 0)
		{
			return Deck;
		}
		const FStaticMeshLODResources& LOD = RenderData->LODResources[0];
		const FPositionVertexBuffer& Positions = LOD.VertexBuffers.PositionVertexBuffer;
		const uint32 VertexCount = Positions.GetNumVertices();
		TArray<uint32> Indices;
		LOD.IndexBuffer.GetCopy(Indices);
		if (VertexCount == 0 || Indices.Num() < 3)
		{
			return Deck;
		}

		// Calls Visit(A, B, C, Area, Bucket) for every horizontal, up-facing triangle.
		constexpr float BucketHeight = 1.f;
		auto ForEachFloorTriangle = [&](auto&& Visit)
		{
			for (int32 i = 0; i + 2 < Indices.Num(); i += 3)
			{
				if (Indices[i] >= VertexCount || Indices[i + 1] >= VertexCount || Indices[i + 2] >= VertexCount)
				{
					continue;
				}
				const FVector A(Positions.VertexPosition(Indices[i]));
				const FVector B(Positions.VertexPosition(Indices[i + 1]));
				const FVector C(Positions.VertexPosition(Indices[i + 2]));
				// Cross product: Z is twice the footprint area, and its sign is the facing.
				const FVector Normal = FVector::CrossProduct(B - A, C - A);
				const float Length = Normal.Size();
				if (Normal.Z <= 0.f || Length < KINDA_SMALL_NUMBER || Normal.Z / Length < 0.98f)
				{
					continue;  // facing down, degenerate, or too steep to stand on
				}
				const int32 Bucket = FMath::RoundToInt((A.Z + B.Z + C.Z) / 3.f / BucketHeight);
				Visit(A, B, C, Normal.Z * 0.5f, Bucket);
			}
		};

		struct FSurface { float Area = 0.f; FVector2D Moment = FVector2D::ZeroVector; };
		TMap<int32, FSurface> Surfaces;
		ForEachFloorTriangle([&](const FVector& A, const FVector& B, const FVector& C, float Area, int32 Bucket)
		{
			FSurface& Surface = Surfaces.FindOrAdd(Bucket);
			Surface.Area += Area;
			const FVector Mid = (A + B + C) / 3.f;
			Surface.Moment += FVector2D(Mid.X, Mid.Y) * Area;
		});

		float Broadest = 0.f;
		for (const TPair<int32, FSurface>& It : Surfaces)
		{
			Broadest = FMath::Max(Broadest, It.Value.Area);
		}
		int32 DeckBucket = INDEX_NONE;
		for (const TPair<int32, FSurface>& It : Surfaces)
		{
			if (It.Value.Area >= Broadest * 0.5f && (DeckBucket == INDEX_NONE || It.Key > DeckBucket))
			{
				DeckBucket = It.Key;
			}
		}
		if (DeckBucket == INDEX_NONE || Broadest <= KINDA_SMALL_NUMBER)
		{
			return Deck;
		}

		const FSurface& Top = Surfaces[DeckBucket];
		Deck.Height = DeckBucket * BucketHeight;
		Deck.Centre = Top.Moment / Top.Area;

		// Radius: the farthest deck vertex from the centre, sanity-bounded by the
		// radius of a disc of the same area so one stray vertex cannot inflate it.
		const float EquivRadius = FMath::Sqrt(Top.Area / PI);
		float Farthest = 0.f;
		ForEachFloorTriangle([&](const FVector& A, const FVector& B, const FVector& C, float, int32 Bucket)
		{
			if (Bucket != DeckBucket)
			{
				return;
			}
			for (const FVector& V : { A, B, C })
			{
				Farthest = FMath::Max(Farthest, static_cast<float>(FVector2D::Distance(FVector2D(V.X, V.Y), Deck.Centre)));
			}
		});
		Deck.Radius = FMath::Clamp(Farthest, EquivRadius, EquivRadius * 1.2f);
		Deck.bMeasured = true;
		return Deck;
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
		const FDeck Deck = MeasureDeck(PlatformArt);
		// The visible deck edge sits just outside the walkable one, so a fighter
		// at the very edge of the collision disc is still standing on stone.
		const float Scale = (PlatformRadius * 1.02f) / FMath::Max(Deck.Radius, 1.f);
		PlatformMesh->SetRelativeScale3D(FVector(Scale));
		// Sink it so the walkable deck lands on Z = 0, centred on the origin.
		const float DeckZ = Deck.Height * Scale;
		PlatformMesh->SetRelativeLocation(FVector(-Deck.Centre.X * Scale, -Deck.Centre.Y * Scale, -DeckZ));
		// The collision disc is now purely functional.
		Floor->SetVisibility(false);

		if (FParse::Param(FCommandLine::Get(), TEXT("MoteDebug")))
		{
			// The deck must land on Z = 0: worldBox max Z is the top of the art.
			UE_LOG(LogTemp, Warning, TEXT("MOTEDBG platform deck=%.2f r=%.2f centre=(%.2f,%.2f) measured=%d (box top %.2f) scale=%.3f worldBox=%s"),
				Deck.Height, Deck.Radius, Deck.Centre.X, Deck.Centre.Y, Deck.bMeasured ? 1 : 0, Box.Max.Z, Scale,
				*PlatformMesh->Bounds.GetBox().ToString());
		}
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
		StillScenery.Add(SceneryMeshes.Num() - 1);
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
		// Above deck height, so the rock reads against the sky instead of
		// disappearing behind the platform's own silhouette.
		const float Angle = FMath::DegreesToRadians(35.f + i * 90.f);
		const FVector Base(FMath::Cos(Angle) * (PlatformRadius + 560.f), FMath::Sin(Angle) * (PlatformRadius + 560.f), 70.f);

		// The rock it stands on. Without one the brazier hangs in open sky.
		if (IslandArt)
		{
			const FBox IB = IslandArt->GetBoundingBox();
			constexpr float RockWidth = 380.f;
			const float RockScale = RockWidth / FMath::Max(FMath::Max(IB.GetSize().X, IB.GetSize().Y), 1.f);
			// Drop it so its peak comes up past the brazier's foot: bedded in, not balanced on.
			const float PeakZ = IB.Max.Z * RockScale;
			AddMesh(IslandArt, FVector(Base.X, Base.Y, Base.Z + 45.f - PeakZ),
				FRotator(0.f, HashRange(i * 91, 0.f, 360.f), 0.f), FVector(RockScale));
			StillScenery.Add(SceneryMeshes.Num() - 1);
		}

		AddMesh(Brazier, Base, FRotator(0.f, HashRange(i * 83, 0.f, 360.f), 0.f), FVector(1.5f));
		StillScenery.Add(SceneryMeshes.Num() - 1);

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
			// At 3 every channel of this warm orange clears 1.0 and the tonemapper
			// renders the embers white - they read as snow, not brazier sparks.
			MID->SetScalarParameterValue(TEXT("Intensity"), 1.6f);
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
		if (!C || !SceneryBaseTransforms.IsValidIndex(i) || StillScenery.Contains(i))
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
