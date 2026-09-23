// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "MoteHUD.generated.h"

struct FMoteHitEvent;
struct FMoteKOEvent;
struct FMoteAnnouncement;
class AMoteGameMode;
class AMoteCharacter;
class UFont;

/** A big centre-screen callout ("READY?", "GO!", "GAME!"). */
struct FMoteHudAnnouncement
{
	FString Text;
	FLinearColor Color = FLinearColor::White;
	float Duration = 1.2f;
	float Age = 0.f;
	int32 Size = 1;
};

/**
 * Every 2D element in the game, drawn with UCanvas (no widget assets):
 *   Title   - "MOTE RUMBLE" logo lockup, "PRESS ENTER", Not Tim Games credit
 *   Select  - 8 fighter cards (accent colour, name, epithet), P1 cursor + rival
 *             cursor (with RANDOM), blurb + stats for the highlighted fighter,
 *             CPU level and stock count, control hints
 *   Fight   - Smash-style damage panels along the bottom (name, huge %, stock
 *             icons); % shakes and flashes on hits and shifts white->yellow->
 *             orange->red->dark red with damage. Combo counter, off-screen
 *             pointer bubbles for fighters outside the view, announcements
 *             (READY? / 3 2 1 / GO! / GAME!), KO callouts, screen flashes
 *   Pause   - dimmed overlay with Resume / Restart / Quit to Select
 *   Results - winner banner in their accent colour + per-fighter stats and the
 *             Rematch / Change Fighters choice
 * Always: a subtle controls strip in menus.
 *
 * Reads all state from AMoteGameMode and the fighters every frame; subscribes to
 * UMoteEventHub for transient reactions. Scales everything from a 1920x1080
 * reference to the actual canvas size.
 */
UCLASS()
class MOTERUMBLE_API AMoteHUD : public AHUD
{
	GENERATED_BODY()

public:
	AMoteHUD();

	virtual void DrawHUD() override;
	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	void OnHit(const FMoteHitEvent& Event);
	void OnKO(const FMoteKOEvent& Event);
	void OnAnnounce(const FMoteAnnouncement& Announcement);
	void OnFlash(const FLinearColor& Color, float Duration);

	AMoteGameMode* GetMoteGameMode() const;

	// ---- drawing helpers ----
	/** Layout scale from the 1920x1080 reference to the real canvas. */
	float Scale() const;
	void Box(float X, float Y, float W, float H, const FLinearColor& Color);
	/** A parallelogram - the shape fighting-game panels are cut from. */
	void Slant(float X, float Y, float W, float H, float Skew, const FLinearColor& Color);
	/** Draws text and returns its size. */
	FVector2D Text(const FString& String, float X, float Y, float Size, const FLinearColor& Color,
		bool bCentre = false, bool bShadow = true, const TCHAR* Typeface = TEXT("Bold"));

	void DrawFighterPanel(AMoteCharacter* Fighter, int32 Index, int32 Count);
	void DrawOffscreenMarkers(AMoteGameMode* GM);
	void DrawTitle(AMoteGameMode* GM);
	void DrawSelect(AMoteGameMode* GM);
	void DrawResults(AMoteGameMode* GM);
	void DrawPause(AMoteGameMode* GM);

	FDelegateHandle HitHandle;
	FDelegateHandle KOHandle;
	FDelegateHandle AnnounceHandle;
	FDelegateHandle FlashHandle;

	UPROPERTY() TObjectPtr<UFont> Font;
	float UiTime = 0.f;
	/** Per-fighter panel shake, decays after each hit. */
	TMap<TWeakObjectPtr<AMoteCharacter>, float> PanelShake;
	TArray<FMoteHudAnnouncement> Announcements;
	float FlashTimer = 0.f;
	float FlashDuration = 0.2f;
	FLinearColor FlashColor = FLinearColor::White;
	float KOCalloutTimer = 0.f;
	FLinearColor KOCalloutColor = FLinearColor::White;
	FString KOCalloutText;
};
