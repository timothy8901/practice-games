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

	FDelegateHandle HitHandle;
	FDelegateHandle KOHandle;
	FDelegateHandle AnnounceHandle;
	FDelegateHandle FlashHandle;

	// Implementation state (fonts, per-fighter shake timers, active announcements,
	// flash, etc.) is up to the implementer.
};
