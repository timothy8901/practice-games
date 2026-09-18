// Copyright Not Tim Games. All Rights Reserved.
// STUB - replaced by the full HUD implementation.

#include "MoteHUD.h"
#include "MoteCharacter.h"
#include "MoteEvents.h"
#include "MoteGameMode.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"

AMoteHUD::AMoteHUD() {}
void AMoteHUD::BeginPlay() { Super::BeginPlay(); }
void AMoteHUD::EndPlay(const EEndPlayReason::Type Reason) { Super::EndPlay(Reason); }
void AMoteHUD::Tick(float DeltaSeconds) { Super::Tick(DeltaSeconds); }

AMoteGameMode* AMoteHUD::GetMoteGameMode() const
{
	return GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
}

void AMoteHUD::DrawHUD()
{
	Super::DrawHUD();
	AMoteGameMode* GM = GetMoteGameMode();
	if (!GM || !Canvas)
	{
		return;
	}
	float X = 80.f;
	for (AMoteCharacter* F : GM->GetFighters())
	{
		if (!F) { continue; }
		const FString Text = FString::Printf(TEXT("%s  %.0f%%  x%d"), *F->GetFighterDef().DisplayName, F->GetPercent(), F->GetStocks());
		DrawText(Text, F->GetAccent(), X, Canvas->ClipY - 80.f, GEngine->GetLargeFont(), 1.5f);
		X += 500.f;
	}
}

void AMoteHUD::OnHit(const FMoteHitEvent&) {}
void AMoteHUD::OnKO(const FMoteKOEvent&) {}
void AMoteHUD::OnAnnounce(const FMoteAnnouncement&) {}
void AMoteHUD::OnFlash(const FLinearColor&, float) {}
