// Copyright Not Tim Games. All Rights Reserved.
//
// Every transient effect in the game, built from pooled primitive meshes plus
// the /Game/FX materials. No Niagara assets: each element is a mesh component
// with an animated dynamic material, ticked by this subsystem.

#include "MoteFX.h"

#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "ProceduralMeshComponent.h"

namespace
{
	const TCHAR* SpherePath = TEXT("/Engine/BasicShapes/Sphere.Sphere");
	const TCHAR* CubePath = TEXT("/Engine/BasicShapes/Cube.Cube");
	const TCHAR* PlanePath = TEXT("/Engine/BasicShapes/Plane.Plane");
	const TCHAR* CylinderPath = TEXT("/Engine/BasicShapes/Cylinder.Cylinder");
	const TCHAR* BasicMatPath = TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial");

	const TCHAR* AdditivePath = TEXT("/Game/FX/M_FX_Additive.M_FX_Additive");
	const TCHAR* RingPath = TEXT("/Game/FX/M_FX_Ring.M_FX_Ring");
	const TCHAR* SmokePath = TEXT("/Game/FX/M_FX_Smoke.M_FX_Smoke");
	const TCHAR* RibbonPath = TEXT("/Game/FX/M_FX_Ribbon.M_FX_Ribbon");

	constexpr int32 MaxElements = 420;

	float RandF(float Min, float Max) { return FMath::FRandRange(Min, Max); }

	FVector RandCone(const FVector& Dir, float SpreadDeg)
	{
		const FVector Axis = Dir.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);
		return FMath::VRandCone(Axis, FMath::DegreesToRadians(SpreadDeg));
	}
}

// ---------------------------------------------------------------------------
//  Pool plumbing
// ---------------------------------------------------------------------------

UMoteFX* UMoteFX::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UMoteFX>() : nullptr;
}

TStatId UMoteFX::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UMoteFX, STATGROUP_Tickables);
}

UStaticMesh* UMoteFX::LoadShape(EMoteFxShape Shape)
{
	const int32 Index = static_cast<int32>(Shape);
	if (!Shapes.IsValidIndex(Index))
	{
		Shapes.SetNum(static_cast<int32>(EMoteFxShape::Count));
	}
	if (!Shapes[Index])
	{
		const TCHAR* Path = SpherePath;
		switch (Shape)
		{
		case EMoteFxShape::Cube:     Path = CubePath; break;
		case EMoteFxShape::Plane:    Path = PlanePath; break;
		case EMoteFxShape::Cylinder: Path = CylinderPath; break;
		default: break;
		}
		Shapes[Index] = LoadObject<UStaticMesh>(nullptr, Path);
	}
	return Shapes[Index];
}

UMaterialInterface* UMoteFX::LoadFxMaterial(EMoteFxMaterial Kind)
{
	const int32 Index = static_cast<int32>(Kind);
	if (!Materials.IsValidIndex(Index))
	{
		Materials.SetNum(static_cast<int32>(EMoteFxMaterial::Count));
	}
	if (!Materials[Index])
	{
		const TCHAR* Path = AdditivePath;
		switch (Kind)
		{
		case EMoteFxMaterial::Ring:   Path = RingPath; break;
		case EMoteFxMaterial::Smoke:  Path = SmokePath; break;
		case EMoteFxMaterial::Ribbon: Path = RibbonPath; break;
		default: break;
		}
		UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, Path, nullptr, LOAD_Quiet | LOAD_NoWarn);
		if (!Mat)
		{
			// The FX materials have not been authored yet: still render something.
			Mat = LoadObject<UMaterialInterface>(nullptr, BasicMatPath, nullptr, LOAD_Quiet | LOAD_NoWarn);
		}
		Materials[Index] = Mat;
	}
	return Materials[Index];
}

AActor* UMoteFX::GetHost()
{
	if (!Host.IsValid())
	{
		UWorld* World = GetWorld();
		if (!World)
		{
			return nullptr;
		}
		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		Params.ObjectFlags |= RF_Transient;
		AActor* A = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, Params);
		if (A)
		{
			USceneComponent* Root = NewObject<USceneComponent>(A, TEXT("FxRoot"));
			A->SetRootComponent(Root);
			Root->RegisterComponent();
#if WITH_EDITOR
			A->SetActorLabel(TEXT("MoteFX"));
#endif
		}
		Host = A;
	}
	return Host.Get();
}

FMoteFxElement* UMoteFX::Spawn(EMoteFxShape Shape, EMoteFxMaterial MatKind, const FVector& Location, float Life)
{
	AActor* HostActor = GetHost();
	UStaticMesh* Mesh = LoadShape(Shape);
	if (!HostActor || !Mesh || Life <= 0.f)
	{
		return nullptr;
	}

	// Recycle a finished element, or make a new one while we have headroom.
	int32 Index = INDEX_NONE;
	for (int32 i = 0; i < Elements.Num(); ++i)
	{
		if (!Elements[i].bActive)
		{
			Index = i;
			break;
		}
	}
	if (Index == INDEX_NONE)
	{
		if (Elements.Num() >= MaxElements)
		{
			// Steal the oldest - a dropped spark is better than a hitch.
			float Best = -1.f;
			for (int32 i = 0; i < Elements.Num(); ++i)
			{
				const float Progress = Elements[i].Age / FMath::Max(Elements[i].Life, 0.01f);
				if (Progress > Best)
				{
					Best = Progress;
					Index = i;
				}
			}
		}
		else
		{
			Index = Elements.AddDefaulted();
			UStaticMeshComponent* Comp = NewObject<UStaticMeshComponent>(HostActor);
			Comp->SetupAttachment(HostActor->GetRootComponent());
			Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
			Comp->SetGenerateOverlapEvents(false);
			Comp->SetCastShadow(false);
			Comp->bReceivesDecals = false;
			Comp->SetUsingAbsoluteLocation(true);
			Comp->SetUsingAbsoluteRotation(true);
			Comp->SetUsingAbsoluteScale(true);
			Comp->RegisterComponent();
			Elements[Index].Comp = Comp;
		}
	}

	FMoteFxElement& E = Elements[Index];
	if (!E.Comp)
	{
		return nullptr;
	}

	// Swap mesh/material only when they actually change (MIDs are per element).
	if (E.Shape != Shape || E.Comp->GetStaticMesh() != Mesh)
	{
		E.Comp->SetStaticMesh(Mesh);
		E.Shape = Shape;
		E.MatKind = EMoteFxMaterial::Count;  // force a material refresh
	}
	if (E.MatKind != MatKind)
	{
		if (UMaterialInterface* Mat = LoadFxMaterial(MatKind))
		{
			E.MID = UMaterialInstanceDynamic::Create(Mat, E.Comp);
			E.Comp->SetMaterial(0, E.MID);
		}
		E.MatKind = MatKind;
	}

	E.bActive = true;
	E.Age = 0.f;
	E.Life = Life;
	E.Location = Location;
	E.Velocity = FVector::ZeroVector;
	E.Accel = FVector::ZeroVector;
	E.Drag = 1.f;
	E.Rotation = FRotator::ZeroRotator;
	E.SpinRate = FRotator::ZeroRotator;
	E.StartScale = FVector::OneVector;
	E.EndScale = FVector::OneVector;
	E.Color = FLinearColor::White;
	E.StartIntensity = 4.f;
	E.EndIntensity = 0.f;
	E.StartOpacity = 1.f;
	E.EndOpacity = 0.f;
	E.RingStart = 0.7f;
	E.RingEnd = 0.95f;
	E.RingWidth = 0.14f;
	E.RimPower = 0.f;
	E.bFaceVelocity = false;
	E.Comp->SetVisibility(true);
	return &E;
}

void UMoteFX::Tick(float DeltaTime)
{
	const float Dt = FMath::Clamp(DeltaTime, 0.f, 0.1f);
	for (FMoteFxElement& E : Elements)
	{
		if (!E.bActive || !E.Comp)
		{
			continue;
		}
		E.Age += Dt;
		const float A = FMath::Clamp(E.Age / FMath::Max(E.Life, 0.001f), 0.f, 1.f);
		if (E.Age >= E.Life)
		{
			E.bActive = false;
			E.Comp->SetVisibility(false);
			continue;
		}

		E.Velocity += E.Accel * Dt;
		E.Velocity *= FMath::Pow(E.Drag, Dt);
		E.Location += E.Velocity * Dt;
		E.Rotation += E.SpinRate * Dt;

		const float Ease = 1.f - FMath::Pow(1.f - A, 3.f);
		const FVector Scale = FMath::Lerp(E.StartScale, E.EndScale, Ease);
		FRotator Rot = E.Rotation;
		if (E.bFaceVelocity && !E.Velocity.IsNearlyZero())
		{
			Rot = E.Velocity.Rotation();
		}
		E.Comp->SetWorldLocationAndRotation(E.Location, Rot);
		E.Comp->SetWorldScale3D(Scale);

		if (E.MID)
		{
			E.MID->SetVectorParameterValue(TEXT("Color"), E.Color);
			E.MID->SetScalarParameterValue(TEXT("Intensity"), FMath::Lerp(E.StartIntensity, E.EndIntensity, A));
			E.MID->SetScalarParameterValue(TEXT("Opacity"), FMath::Lerp(E.StartOpacity, E.EndOpacity, A));
			if (E.MatKind == EMoteFxMaterial::Ring)
			{
				E.MID->SetScalarParameterValue(TEXT("RingRadius"), FMath::Lerp(E.RingStart, E.RingEnd, Ease));
				E.MID->SetScalarParameterValue(TEXT("RingWidth"), E.RingWidth * (1.f - A * 0.6f));
			}
			else
			{
				E.MID->SetScalarParameterValue(TEXT("RimPower"), E.RimPower);
			}
		}
	}
}

// ---------------------------------------------------------------------------
//  Building blocks
// ---------------------------------------------------------------------------

void UMoteFX::Flash(const FVector& Location, float Radius, const FLinearColor& Color, float Life, float Intensity)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, Life))
	{
		const float S = Radius / 50.f;  // engine sphere is 100 across
		E->StartScale = FVector(S * 0.55f);
		E->EndScale = FVector(S);
		E->Color = Color;
		E->StartIntensity = Intensity;
		E->EndIntensity = 0.f;
		E->StartOpacity = 1.f;
		E->RimPower = 1.6f;
	}
}

void UMoteFX::Ring(const FVector& Location, const FRotator& Rotation, float Radius, const FLinearColor& Color,
	float Life, float Width, float Intensity)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Plane, EMoteFxMaterial::Ring, Location, Life))
	{
		const float S = Radius / 50.f;
		E->Rotation = Rotation;
		E->StartScale = FVector(S * 0.35f, S * 0.35f, 1.f);
		E->EndScale = FVector(S, S, 1.f);
		E->Color = Color;
		E->StartIntensity = Intensity;
		E->EndIntensity = Intensity * 0.15f;
		E->RingStart = 0.55f;
		E->RingEnd = 0.92f;
		E->RingWidth = Width;
	}
}

void UMoteFX::Streak(const FVector& Location, const FVector& Velocity, float Length, float Thickness,
	const FLinearColor& Color, float Life, float Gravity)
{
	// A stretched sphere, not a cube. All of M_FX_Additive's softness comes from
	// its fresnel term, and a cube's face normals are constant across each face,
	// so RimPower has nothing to grade against: every spark came out a hard-edged
	// slab clipped to white. An ellipsoid fades to nothing at its own silhouette.
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, Life))
	{
		E->Velocity = Velocity;
		E->Accel = FVector(0.f, 0.f, -Gravity);
		E->Drag = 0.12f;
		E->bFaceVelocity = true;
		// Fatter across than the old box: the rim falloff eats the outer edge, so
		// the same Thickness reads thinner than it did as a solid slab.
		E->StartScale = FVector(Length / 100.f, Thickness / 70.f, Thickness / 70.f);
		E->EndScale = FVector(Length / 260.f, Thickness / 300.f, Thickness / 300.f);
		E->Color = Color;
		E->StartIntensity = 3.2f;
		E->EndIntensity = 0.f;
		E->StartOpacity = 0.9f;
		E->RimPower = 2.2f;
	}
}

void UMoteFX::Puff(const FVector& Location, const FVector& Velocity, float Radius, const FLinearColor& Color, float Life)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Smoke, Location, Life))
	{
		E->Velocity = Velocity;
		E->Drag = 0.25f;
		E->SpinRate = FRotator(RandF(-40.f, 40.f), RandF(-40.f, 40.f), 0.f);
		// Dust and smoke, not fog. The engine sphere is 100 across, so these
		// read as 0.87*Radius blooming to 1.39*Radius - a 1.6x growth. The old
		// 140 -> 45 pair grew 3.1x, to 2.2*Radius: a charged Maul Earthshaker
		// (Radius 162) finished 3.6 m across, taller than two fighters, and its
		// puffs sat on a 3.2 m ring, so they merged into one grey dome 6.8 m
		// wide - a third of the frame, with the deck lost behind it.
		E->StartScale = FVector(Radius / 115.f);
		E->EndScale = FVector(Radius / 72.f);
		E->Color = Color;
		// M_FX_Smoke is Opacity * (1 - Fresnel(RimPower)), which is much flatter
		// than a soft ball - the disc averages ~0.82 of Opacity - so at 0.55 two
		// overlapping puffs already composited to 0.70 and three to 0.83.
		// (DESIGN.md documents pow(dot(N,V), RimPower) here; the authored
		// material is not that. Re-tune if the material is ever corrected.)
		E->StartOpacity = 0.30f;
		E->EndOpacity = 0.f;
		E->RimPower = 2.2f;
	}
}

void UMoteFX::Beam(const FVector& From, const FVector& To, float Thickness, const FLinearColor& Color, float Life)
{
	const FVector Delta = To - From;
	const float Len = Delta.Size();
	if (Len < 1.f)
	{
		return;
	}
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Cylinder, EMoteFxMaterial::Additive, (From + To) * 0.5f, Life))
	{
		// The engine cylinder is 100 tall on Z: point its Z along the beam.
		E->Rotation = FRotationMatrix::MakeFromZ(Delta / Len).Rotator();
		E->StartScale = FVector(Thickness / 100.f, Thickness / 100.f, Len / 100.f);
		E->EndScale = FVector(Thickness / 320.f, Thickness / 320.f, Len / 100.f);
		E->Color = Color;
		// RimPower gives the beam a soft round cross-section: unlike a cube, a
		// cylinder's normals turn away at its silhouette, so the fresnel has
		// something to fade. At RimPower 0 and intensity 9 every beam - the KO
		// blast, the respawn column, lightning, the spark filaments - was a flat
		// hard-edged bar clipped to a single colour.
		E->StartIntensity = 4.5f;
		E->EndIntensity = 0.f;
		E->RimPower = 1.5f;
	}
}

// ---------------------------------------------------------------------------
//  Combat effects
// ---------------------------------------------------------------------------

void UMoteFX::HitSpark(const FVector& Location, const FVector& Direction, EMoteFxType Type,
	const FLinearColor& Color, float Strength)
{
	const float S = FMath::Clamp(Strength, 0.2f, 2.f);
	const FVector Dir = Direction.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);

	// White-hot core that collapses fast. Well under the old 11/6: a dozen-plus
	// additive sparks land on top of these two, and the sum was clipping the whole
	// impact to a flat white disc with no accent colour left in it.
	Flash(Location, 46.f * (0.7f + S * 0.6f), FLinearColor(1.f, 0.96f, 0.85f), 0.12f, 6.5f);
	Flash(Location, 80.f * (0.6f + S * 0.8f), Color, 0.2f, 4.f);

	// Sparks thrown along the launch direction.
	const int32 Count = FMath::RoundToInt(FMath::Lerp(5.f, 18.f, FMath::Min(S / 2.f, 1.f)));
	for (int32 i = 0; i < Count; ++i)
	{
		const FVector V = RandCone(Dir, 58.f) * RandF(500.f, 1500.f) * (0.6f + S * 0.5f);
		Streak(Location, V, RandF(40.f, 110.f) * S, RandF(5.f, 11.f), Color, RandF(0.14f, 0.3f), 900.f);
	}

	switch (Type)
	{
	case EMoteFxType::Slash:
	{
		// Two crossing blade flashes.
		for (int32 i = 0; i < 2; ++i)
		{
			if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, 0.16f))
			{
				E->Rotation = FRotator(RandF(-40.f, 40.f), RandF(0.f, 360.f), i == 0 ? 35.f : -35.f);
				// A flattened ellipsoid, not a paper-thin cube: scaled this far down on
				// one axis the cube was a literal white quad with four straight edges.
				E->StartScale = FVector(2.4f * S, 0.07f, 0.5f * S);
				E->EndScale = FVector(3.4f * S, 0.015f, 0.1f * S);
				E->Color = FLinearColor::LerpUsingHSV(Color, FLinearColor::White, 0.45f);
				E->StartIntensity = 4.5f;
				E->StartOpacity = 0.9f;
				E->RimPower = 1.8f;
			}
		}
		break;
	}
	case EMoteFxType::Blunt:
		Ring(Location, FRotator(90.f, Dir.Rotation().Yaw, 0.f), 130.f * S, Color, 0.22f, 0.2f, 7.f);
		for (int32 i = 0; i < 4; ++i)
		{
			Puff(Location, RandCone(Dir, 80.f) * RandF(120.f, 320.f), 70.f * S, FLinearColor(0.7f, 0.65f, 0.6f), 0.5f);
		}
		break;
	case EMoteFxType::Fire:
		for (int32 i = 0; i < 6; ++i)
		{
			Puff(Location, RandCone(Dir, 70.f) * RandF(200.f, 520.f), 80.f * S,
				FLinearColor(1.f, 0.42f, 0.1f), RandF(0.25f, 0.5f));
		}
		Flash(Location, 110.f * S, FLinearColor(1.f, 0.5f, 0.12f), 0.24f, 8.f);
		break;
	case EMoteFxType::Electric:
		for (int32 i = 0; i < 5; ++i)
		{
			const FVector A = Location + FMath::VRand() * RandF(10.f, 40.f);
			const FVector B = A + FMath::VRand() * RandF(60.f, 160.f) * S;
			Beam(A, B, 7.f, FLinearColor(1.f, 0.95f, 0.55f), RandF(0.07f, 0.16f));
		}
		break;
	case EMoteFxType::Pierce:
		Streak(Location, Dir * 2200.f, 220.f * S, 9.f, FLinearColor::LerpUsingHSV(Color, FLinearColor::White, 0.5f), 0.14f, 0.f);
		break;
	case EMoteFxType::Explosion:
		Explosion(Location, 140.f * S);
		break;
	default:
		break;
	}

	if (S > 0.9f)
	{
		// A shockwave ring facing the camera-ish plane for the meaty ones.
		Ring(Location, FRotator(90.f, Dir.Rotation().Yaw + 90.f, 0.f), 190.f * S, Color, 0.26f, 0.13f, 8.f);
	}
}

void UMoteFX::BlockSpark(const FVector& Location, const FLinearColor& Color)
{
	Flash(Location, 70.f, FLinearColor(0.75f, 0.92f, 1.f), 0.16f, 7.f);
	Ring(Location, FMath::VRand().Rotation(), 120.f, Color, 0.22f, 0.22f, 5.f);
	for (int32 i = 0; i < 5; ++i)
	{
		Streak(Location, FMath::VRand() * RandF(300.f, 700.f), 40.f, 6.f, FLinearColor(0.8f, 0.95f, 1.f), 0.18f, 300.f);
	}
}

void UMoteFX::SlashArc(const FVector& Center, const FRotator& Facing, float Radius, float ArcDegrees,
	const FLinearColor& Color, bool bRightToLeft, float Strength)
{
	// A swept crescent built from overlapping segments, each fading a beat later.
	const int32 Segments = FMath::Clamp(FMath::RoundToInt(ArcDegrees / 16.f), 5, 22);
	const float Half = ArcDegrees * 0.5f;
	const float Sign = bRightToLeft ? 1.f : -1.f;
	for (int32 i = 0; i < Segments; ++i)
	{
		const float T = static_cast<float>(i) / (Segments - 1);
		const float AngleDeg = Facing.Yaw + Sign * FMath::Lerp(Half, -Half, T);
		const float A = FMath::DegreesToRadians(AngleDeg);
		const FVector Pos = Center + FVector(FMath::Cos(A), FMath::Sin(A), 0.f) * Radius * 0.85f;
		// Ellipsoids, not paper-thin cubes. A chain of flat boxes read as a
		// faceted white band with a visible straight edge per segment - the
		// single most cardboard thing on screen during a swing.
		if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Pos, 0.2f + T * 0.05f))
		{
			E->Rotation = FRotator(0.f, AngleDeg + 90.f, 0.f);
			const float W = FMath::Sin(T * PI) * 0.55f + 0.25f;  // fat in the middle
			E->StartScale = FVector(Radius / 130.f * W, 0.085f, 0.5f * W * Strength);
			E->EndScale = FVector(Radius / 220.f * W, 0.015f, 0.12f * W);
			E->Color = FLinearColor::LerpUsingHSV(Color, FLinearColor::White, 0.35f);
			E->StartIntensity = 3.4f * FMath::Clamp(Strength, 0.4f, 1.6f);
			E->EndIntensity = 0.f;
			E->StartOpacity = 0.9f;
			E->RimPower = 2.0f;
		}
	}
}

void UMoteFX::Shockwave(const FVector& Location, float Radius, const FLinearColor& Color, float Strength)
{
	// Intensity is clamped: 7 * Strength reached 12.6 on a charged Earthshaker,
	// which is a solid white annulus rather than a ring of light.
	Ring(Location + FVector(0.f, 0.f, 12.f), FRotator::ZeroRotator, Radius, Color, 0.38f, 0.16f,
		FMath::Min(4.5f * Strength, 6.f));
	Ring(Location + FVector(0.f, 0.f, 8.f), FRotator::ZeroRotator, Radius * 0.65f, FLinearColor::White, 0.24f, 0.1f, 3.5f);
	// Six, not eight, and SPACED rather than scattered. The centres ride a ring
	// of Radius*0.4 (1.58 m on a charged Maul) and each puff is 1.41 m across at
	// birth. At independent random angles several routinely land within a
	// puff-width of each other and fuse on the first frame - that is what turned
	// the ring into a ball, and six random puffs do it too. Even 60-degree steps
	// put them 1.58 m apart, wider than a new puff; the random phase keeps the
	// ring from looking stamped.
	const float Phase = RandF(0.f, 2.f * PI);
	for (int32 i = 0; i < 6; ++i)
	{
		const float A = Phase + static_cast<float>(i) * (2.f * PI / 6.f);
		const FVector Out(FMath::Cos(A), FMath::Sin(A), 0.f);
		Puff(Location + Out * Radius * 0.4f, Out * RandF(200.f, 480.f) + FVector(0.f, 0.f, RandF(60.f, 220.f)),
			90.f * Strength, FLinearColor(0.72f, 0.66f, 0.58f), RandF(0.45f, 0.8f));
	}
}

void UMoteFX::Explosion(const FVector& Location, float Radius)
{
	Flash(Location, Radius * 0.9f, FLinearColor(1.f, 0.85f, 0.45f), 0.16f, 14.f);
	Flash(Location, Radius * 1.35f, FLinearColor(1.f, 0.42f, 0.09f), 0.34f, 8.f);
	Ring(Location, FRotator::ZeroRotator, Radius * 2.f, FLinearColor(1.f, 0.6f, 0.2f), 0.4f, 0.14f, 8.f);
	// Seven is enough: these all sit inside a Radius*0.35 sphere, so every
	// one overlaps every other and ten layers pinned the core solid (0.94
	// coverage whatever the opacity is).
	for (int32 i = 0; i < 7; ++i)
	{
		Puff(Location + FMath::VRand() * Radius * 0.35f,
			FMath::VRand() * RandF(150.f, 420.f) + FVector(0.f, 0.f, 180.f),
			Radius * 0.85f, FLinearColor(0.32f, 0.28f, 0.26f), RandF(0.7f, 1.2f));
	}
	for (int32 i = 0; i < 12; ++i)
	{
		Streak(Location, FMath::VRand() * RandF(700.f, 1900.f), RandF(60.f, 150.f), RandF(6.f, 13.f),
			FLinearColor(1.f, 0.7f, 0.25f), RandF(0.2f, 0.45f), 1400.f);
	}
}

void UMoteFX::LightningWarning(const FVector& GroundLocation, float Radius, float Duration, const FLinearColor& Color)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Plane, EMoteFxMaterial::Ring, GroundLocation + FVector(0, 0, 6.f), Duration))
	{
		const float S = Radius / 50.f;
		E->StartScale = FVector(S, S, 1.f);
		E->EndScale = FVector(S, S, 1.f);
		E->Color = Color;
		E->StartIntensity = 3.f;
		E->EndIntensity = 9.f;
		// Hold the opacity flat. Spawn's default fades 1 -> 0, which exactly
		// cancelled the intensity ramp: the warning ring peaked a third of the
		// way in and was black by the time the bolt actually landed.
		E->StartOpacity = 1.f;
		E->EndOpacity = 1.f;
		E->RingStart = 0.9f;
		E->RingEnd = 0.55f;
		E->RingWidth = 0.1f;
	}
}

void UMoteFX::Lightning(const FVector& GroundLocation, float Radius, const FLinearColor& Color)
{
	// A jagged bolt out of the sky, plus a couple of branches.
	FVector P = GroundLocation + FVector(0.f, 0.f, 1500.f);
	const int32 Steps = 9;
	for (int32 i = 0; i < Steps; ++i)
	{
		const float T = static_cast<float>(i + 1) / Steps;
		FVector Next = FMath::Lerp(GroundLocation + FVector(0.f, 0.f, 1500.f), GroundLocation, T);
		Next += FVector(RandF(-70.f, 70.f), RandF(-70.f, 70.f), 0.f) * (1.f - T);
		Beam(P, Next, 16.f, FLinearColor(1.f, 0.96f, 0.6f), 0.22f);
		if (i > 2 && FMath::FRand() < 0.4f)
		{
			Beam(P, P + FVector(RandF(-180.f, 180.f), RandF(-180.f, 180.f), RandF(-160.f, -40.f)), 8.f,
				FLinearColor(1.f, 0.9f, 0.5f), 0.14f);
		}
		P = Next;
	}
	Flash(GroundLocation + FVector(0, 0, 40.f), Radius * 1.2f, Color, 0.25f, 12.f);
	Ring(GroundLocation + FVector(0, 0, 10.f), FRotator::ZeroRotator, Radius * 1.8f, Color, 0.35f, 0.12f, 9.f);
	for (int32 i = 0; i < 10; ++i)
	{
		Streak(GroundLocation, FMath::VRand() * RandF(600.f, 1500.f) + FVector(0, 0, 400.f), 90.f, 8.f,
			FLinearColor(1.f, 0.95f, 0.6f), 0.25f, 1200.f);
	}
}

void UMoteFX::FireBurst(const FVector& Location, const FVector& Direction, float Scale)
{
	for (int32 i = 0; i < 4; ++i)
	{
		Puff(Location, RandCone(Direction, 45.f) * RandF(180.f, 520.f) * Scale, 90.f * Scale,
			FLinearColor(1.f, 0.45f, 0.12f), RandF(0.22f, 0.45f));
	}
	Flash(Location, 70.f * Scale, FLinearColor(1.f, 0.55f, 0.15f), 0.18f, 7.f);
}

void UMoteFX::ChargeSparkle(const FVector& Location, const FLinearColor& Color, float Charge01)
{
	// Motes of light rushing inward, faster as the charge builds.
	const int32 Count = 1 + FMath::RoundToInt(Charge01 * 2.f);
	for (int32 i = 0; i < Count; ++i)
	{
		const FVector Offset = FMath::VRand() * RandF(120.f, 260.f);
		if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location + Offset, 0.28f))
		{
			E->Velocity = -Offset * 3.2f;
			E->StartScale = FVector(0.16f + Charge01 * 0.1f);
			E->EndScale = FVector(0.02f);
			E->Color = Color;
			E->StartIntensity = 8.f;
			E->RimPower = 1.4f;
		}
	}
}

void UMoteFX::ChargeReady(const FVector& Location, const FLinearColor& Color)
{
	Flash(Location, 120.f, FLinearColor::White, 0.18f, 10.f);
	Ring(Location, FMath::VRand().Rotation(), 220.f, Color, 0.3f, 0.12f, 8.f);
}

void UMoteFX::ShieldBreak(const FVector& Location, const FLinearColor& Color)
{
	Flash(Location, 150.f, FLinearColor(0.9f, 0.95f, 1.f), 0.2f, 10.f);
	Ring(Location, FRotator(90.f, 0.f, 0.f), 260.f, Color, 0.4f, 0.1f, 7.f);
	for (int32 i = 0; i < 16; ++i)
	{
		if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, RandF(0.4f, 0.8f)))
		{
			E->Velocity = FMath::VRand() * RandF(400.f, 1100.f);
			E->Accel = FVector(0.f, 0.f, -1600.f);
			E->Drag = 0.6f;
			E->SpinRate = FRotator(RandF(-600.f, 600.f), RandF(-600.f, 600.f), RandF(-600.f, 600.f));
			E->StartScale = FVector(RandF(0.1f, 0.22f));
			E->EndScale = FVector(0.02f);
			E->Color = Color;
			// Shards of a broken shield, not little white boxes: additive at 6
			// with flat cube normals clipped every one of them to pure white.
			E->StartIntensity = 3.2f;
			E->StartOpacity = 0.9f;
			E->RimPower = 1.8f;
		}
	}
}

void UMoteFX::Reflect(const FVector& Location, const FLinearColor& Color)
{
	Flash(Location, 90.f, FLinearColor::White, 0.14f, 9.f);
	Ring(Location, FMath::VRand().Rotation(), 150.f, Color, 0.25f, 0.16f, 7.f);
}

// ---------------------------------------------------------------------------
//  Movement effects
// ---------------------------------------------------------------------------

void UMoteFX::Dust(const FVector& GroundLocation, float Scale)
{
	for (int32 i = 0; i < 5; ++i)
	{
		const float A = RandF(0.f, 2.f * PI);
		const FVector Out(FMath::Cos(A), FMath::Sin(A), 0.f);
		Puff(GroundLocation + Out * 20.f, Out * RandF(90.f, 260.f) * Scale + FVector(0.f, 0.f, RandF(40.f, 120.f)),
			70.f * Scale, FLinearColor(0.78f, 0.72f, 0.62f), RandF(0.4f, 0.75f));
	}
}

void UMoteFX::JumpPuff(const FVector& Location, const FLinearColor& Color, bool bAir)
{
	if (bAir)
	{
		// A floating magic ring the fighter kicks off.
		Ring(Location, FRotator::ZeroRotator, 150.f, Color, 0.35f, 0.16f, 7.f);
		for (int32 i = 0; i < 6; ++i)
		{
			Streak(Location, FMath::VRand() * RandF(150.f, 420.f), 40.f, 6.f, Color, 0.3f, 200.f);
		}
	}
	else
	{
		Ring(Location, FRotator::ZeroRotator, 110.f, FLinearColor(0.85f, 0.82f, 0.75f), 0.28f, 0.2f, 3.f);
		Dust(Location, 0.7f);
	}
}

void UMoteFX::LaunchSmoke(const FVector& Location, const FVector& Velocity, float Strength)
{
	Puff(Location, -Velocity * 0.1f, 55.f * Strength, FLinearColor(0.8f, 0.78f, 0.75f), 0.4f);
	Streak(Location, -Velocity * 0.25f, 120.f * Strength, 9.f, FLinearColor(1.f, 0.95f, 0.85f), 0.18f, 0.f);
}

void UMoteFX::DashStreak(const FVector& Location, const FVector& Direction, const FLinearColor& Color)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, 0.22f))
	{
		E->Rotation = Direction.Rotation();
		E->StartScale = FVector(1.6f, 0.075f, 0.75f);
		E->EndScale = FVector(2.6f, 0.015f, 0.1f);
		E->Color = Color;
		E->StartIntensity = 3.2f;
		E->StartOpacity = 0.9f;
		E->RimPower = 2.0f;
	}
}

// ---------------------------------------------------------------------------
//  Match effects
// ---------------------------------------------------------------------------

void UMoteFX::KOBlast(const FVector& Location, const FVector& InwardDirection, const FLinearColor& Color)
{
	const FVector In = InwardDirection.GetSafeNormal(UE_SMALL_NUMBER, FVector::UpVector);

	// A column of light firing back toward the stage, with a big flare at its base.
	Beam(Location, Location + In * 2600.f, 260.f, Color, 0.55f);
	Beam(Location, Location + In * 1500.f, 120.f, FLinearColor::White, 0.4f);
	Flash(Location, 520.f, FLinearColor::White, 0.3f, 16.f);
	Flash(Location, 900.f, Color, 0.6f, 9.f);
	Ring(Location, In.Rotation() + FRotator(90.f, 0.f, 0.f), 1400.f, Color, 0.7f, 0.08f, 10.f);
	for (int32 i = 0; i < 26; ++i)
	{
		Streak(Location, RandCone(In, 75.f) * RandF(900.f, 3200.f), RandF(120.f, 300.f), RandF(10.f, 22.f),
			FLinearColor::LerpUsingHSV(Color, FLinearColor::White, 0.4f), RandF(0.35f, 0.7f), 0.f);
	}
}

void UMoteFX::RespawnBeam(const FVector& Location, const FLinearColor& Color)
{
	Beam(Location + FVector(0.f, 0.f, -180.f), Location + FVector(0.f, 0.f, 620.f), 62.f, Color, 0.5f);
	Flash(Location, 150.f, FLinearColor::White, 0.3f, 7.f);
	Ring(Location + FVector(0.f, 0.f, -70.f), FRotator::ZeroRotator, 320.f, Color, 0.6f, 0.12f, 7.f);
	for (int32 i = 0; i < 10; ++i)
	{
		const FVector Offset = FMath::VRand() * RandF(60.f, 200.f);
		if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location + Offset, 0.6f))
		{
			E->Velocity = FVector(0.f, 0.f, RandF(120.f, 380.f));
			E->StartScale = FVector(0.12f);
			E->EndScale = FVector(0.01f);
			E->Color = Color;
			E->StartIntensity = 7.f;
			E->RimPower = 1.5f;
		}
	}
}

void UMoteFX::ProjectileTrail(const FVector& Location, const FLinearColor& Color, float Size)
{
	if (FMoteFxElement* E = Spawn(EMoteFxShape::Sphere, EMoteFxMaterial::Additive, Location, 0.22f))
	{
		E->StartScale = FVector(0.34f * Size);
		E->EndScale = FVector(0.04f * Size);
		E->Color = Color;
		E->StartIntensity = 6.f;
		E->RimPower = 1.5f;
	}
}

// ===========================================================================
//  Weapon trail
// ===========================================================================

UMoteWeaponTrail::UMoteWeaponTrail()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostPhysics;
}

void UMoteWeaponTrail::OnRegister()
{
	Super::OnRegister();
	if (!Mesh)
	{
		Mesh = NewObject<UProceduralMeshComponent>(GetOwner(), TEXT("TrailMesh"));
		Mesh->SetupAttachment(this);
		Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Mesh->SetCastShadow(false);
		Mesh->bUseAsyncCooking = false;
		// Vertices are authored in world space.
		Mesh->SetUsingAbsoluteLocation(true);
		Mesh->SetUsingAbsoluteRotation(true);
		Mesh->SetUsingAbsoluteScale(true);
		Mesh->RegisterComponent();

		UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, RibbonPath, nullptr, LOAD_Quiet | LOAD_NoWarn);
		if (!Mat)
		{
			Mat = LoadObject<UMaterialInterface>(nullptr, BasicMatPath, nullptr, LOAD_Quiet | LOAD_NoWarn);
		}
		if (Mat)
		{
			MID = UMaterialInstanceDynamic::Create(Mat, this);
			MID->SetVectorParameterValue(TEXT("Color"), Color);
			MID->SetScalarParameterValue(TEXT("Intensity"), 6.f);
			MID->SetScalarParameterValue(TEXT("Opacity"), 1.f);
			Mesh->SetMaterial(0, MID);
		}
	}
}

void UMoteWeaponTrail::SetColor(const FLinearColor& InColor)
{
	Color = InColor;
	if (MID)
	{
		MID->SetVectorParameterValue(TEXT("Color"), FLinearColor::LerpUsingHSV(Color, FLinearColor::White, 0.35f));
	}
}

void UMoteWeaponTrail::SetEmitting(bool bInEmitting)
{
	bEmitting = bInEmitting;
}

void UMoteWeaponTrail::Clear()
{
	Samples.Reset();
	if (Mesh)
	{
		Mesh->ClearAllMeshSections();
	}
}

void UMoteWeaponTrail::AddSample(const FVector& Base, const FVector& Tip)
{
	if (!bEmitting)
	{
		return;
	}
	// Skip samples that have barely moved so the ribbon stays clean.
	if (Samples.Num() > 0)
	{
		const FTrailSample& Last = Samples.Last();
		if (FVector::DistSquared(Last.Tip, Tip) < FMath::Square(6.f))
		{
			return;
		}
	}
	Samples.Add({ Base, Tip, 0.f });
	while (Samples.Num() > 26)
	{
		Samples.RemoveAt(0, EAllowShrinking::No);
	}
}

void UMoteWeaponTrail::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	constexpr float TrailLife = 0.2f;
	for (int32 i = Samples.Num() - 1; i >= 0; --i)
	{
		Samples[i].Age += DeltaTime;
		if (Samples[i].Age > TrailLife)
		{
			Samples.RemoveAt(0, i + 1, EAllowShrinking::No);
			break;
		}
	}

	if (!Mesh)
	{
		return;
	}
	if (Samples.Num() < 2)
	{
		Mesh->ClearAllMeshSections();
		return;
	}

	// Build a ribbon: U runs 0 (newest) -> 1 (oldest), V runs base -> tip.
	const int32 Num = Samples.Num();
	TArray<FVector> Verts;
	TArray<int32> Tris;
	TArray<FVector2D> UVs;
	TArray<FVector> Normals;
	Verts.Reserve(Num * 2);
	UVs.Reserve(Num * 2);
	Normals.Reserve(Num * 2);

	for (int32 i = 0; i < Num; ++i)
	{
		// Newest sample is at the end of the array.
		const FTrailSample& S = Samples[Num - 1 - i];
		const float U = static_cast<float>(i) / (Num - 1);
		Verts.Add(S.Base);
		Verts.Add(S.Tip);
		UVs.Add(FVector2D(U, 0.f));
		UVs.Add(FVector2D(U, 1.f));
		const FVector N = FVector::CrossProduct((S.Tip - S.Base).GetSafeNormal(), FVector::UpVector);
		Normals.Add(N);
		Normals.Add(N);
	}
	for (int32 i = 0; i < Num - 1; ++i)
	{
		const int32 A = i * 2;
		Tris.Append({ A, A + 1, A + 2, A + 1, A + 3, A + 2 });
	}

	Mesh->CreateMeshSection(0, Verts, Tris, Normals, UVs, TArray<FColor>(), TArray<FProcMeshTangent>(), false);
	if (MID)
	{
		MID->SetScalarParameterValue(TEXT("Opacity"), bEmitting ? 1.f : 0.6f);
	}
}
