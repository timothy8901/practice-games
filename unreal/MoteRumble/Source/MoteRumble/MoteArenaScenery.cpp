// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full scenery implementation.

#include "MoteArena.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"

void AMoteArena::BuildScenery()
{
	if (UMaterialInstanceDynamic* MID = Floor->CreateAndSetMaterialInstanceDynamic(0))
	{
		MID->SetVectorParameterValue(TEXT("Color"), FLinearColor(0.78f, 0.70f, 0.58f));
	}
}

void AMoteArena::TickScenery(float DeltaSeconds)
{
}
