// Copyright Not Tim Games. All Rights Reserved.
//
// Every 2D element, drawn with UCanvas: the fight HUD, the title screen, the
// fighter select, the pause overlay and the results screen. No widget assets.

#include "MoteHUD.h"

#include "MoteArena.h"
#include "MoteCharacter.h"
#include "MoteEvents.h"
#include "MoteGameMode.h"

#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Fonts/FontMeasure.h"
#include "Framework/Application/SlateApplication.h"
#include "Misc/App.h"

namespace
{
	/** The layout is authored against 1920x1080 and scaled to fit. */
	constexpr float RefW = 1920.f;
	constexpr float RefH = 1080.f;

	const FLinearColor Ink(0.03f, 0.035f, 0.05f, 1.f);
	const FLinearColor Paper(0.96f, 0.96f, 0.98f, 1.f);

	/**
	 * The damage-panel band, in reference units: the plate height and the gap
	 * between its bottom edge and the bottom of the frame. DrawFighterPanel lays
	 * the plates out from these and DrawOffscreenMarkers keeps its bubbles clear
	 * of them, so the two have to read the same pair of numbers.
	 */
	constexpr float PanelBandH = 124.f;
	constexpr float PanelBandInset = 40.f;

	/** Damage colour ramp: clean white to furious red. */
	FLinearColor PercentColour(float Percent)
	{
		if (Percent < 40.f)  { return FMath::Lerp(FLinearColor(1.f, 1.f, 1.f), FLinearColor(1.f, 0.95f, 0.45f), Percent / 40.f); }
		if (Percent < 90.f)  { return FMath::Lerp(FLinearColor(1.f, 0.95f, 0.45f), FLinearColor(1.f, 0.55f, 0.15f), (Percent - 40.f) / 50.f); }
		if (Percent < 150.f) { return FMath::Lerp(FLinearColor(1.f, 0.55f, 0.15f), FLinearColor(1.f, 0.18f, 0.12f), (Percent - 90.f) / 60.f); }
		return FMath::Lerp(FLinearColor(1.f, 0.18f, 0.12f), FLinearColor(0.75f, 0.05f, 0.08f), FMath::Min((Percent - 150.f) / 100.f, 1.f));
	}
}

AMoteHUD::AMoteHUD()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AMoteHUD::BeginPlay()
{
	Super::BeginPlay();

	// Roboto's Black face carries the fighting-game weight we want.
	Font = LoadObject<UFont>(nullptr, TEXT("/Engine/EngineFonts/Roboto.Roboto"), nullptr, LOAD_Quiet | LOAD_NoWarn);

	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		HitHandle = Hub->OnHit.AddUObject(this, &AMoteHUD::OnHit);
		KOHandle = Hub->OnKO.AddUObject(this, &AMoteHUD::OnKO);
		AnnounceHandle = Hub->OnAnnounce.AddUObject(this, &AMoteHUD::OnAnnounce);
		FlashHandle = Hub->OnScreenFlash.AddUObject(this, &AMoteHUD::OnFlash);
	}
}

void AMoteHUD::EndPlay(const EEndPlayReason::Type Reason)
{
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->OnHit.Remove(HitHandle);
		Hub->OnKO.Remove(KOHandle);
		Hub->OnAnnounce.Remove(AnnounceHandle);
		Hub->OnScreenFlash.Remove(FlashHandle);
	}
	Super::EndPlay(Reason);
}

AMoteGameMode* AMoteHUD::GetMoteGameMode() const
{
	return GetWorld() ? GetWorld()->GetAuthGameMode<AMoteGameMode>() : nullptr;
}

void AMoteHUD::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	// Real time so the UI keeps its snap during slow motion.
	const float Dt = FMath::Clamp(static_cast<float>(FApp::GetDeltaTime()), 0.f, 0.1f);
	UiTime += Dt;

	for (TPair<TWeakObjectPtr<AMoteCharacter>, float>& Pair : PanelShake)
	{
		Pair.Value = FMath::Max(0.f, Pair.Value - Dt * 3.2f);
	}
	FlashTimer = FMath::Max(0.f, FlashTimer - Dt);
	KOCalloutTimer = FMath::Max(0.f, KOCalloutTimer - Dt);
	for (int32 i = Announcements.Num() - 1; i >= 0; --i)
	{
		Announcements[i].Age += Dt;
		if (Announcements[i].Age > Announcements[i].Duration)
		{
			Announcements.RemoveAt(i);
		}
	}
}

// ---------------------------------------------------------------------------
//  Events
// ---------------------------------------------------------------------------

void AMoteHUD::OnHit(const FMoteHitEvent& Event)
{
	if (Event.Victim.IsValid() && !Event.bBlocked)
	{
		PanelShake.FindOrAdd(Event.Victim) = FMath::Min(1.f, 0.35f + Event.Damage * 0.05f);
	}
}

void AMoteHUD::OnKO(const FMoteKOEvent& Event)
{
	KOCalloutTimer = 1.6f;
	KOCalloutColor = Event.Victim.IsValid() ? Event.Victim->GetAccent() : FLinearColor::White;
	KOCalloutText = Event.bFinal ? TEXT("K.O.!") : TEXT("KO!");
}

void AMoteHUD::OnAnnounce(const FMoteAnnouncement& Announcement)
{
	FMoteHudAnnouncement A;
	A.Text = Announcement.Text;
	A.Color = Announcement.Color;
	A.Duration = Announcement.Duration;
	A.Size = Announcement.Size;
	Announcements.Add(A);
}

void AMoteHUD::OnFlash(const FLinearColor& Color, float Duration)
{
	FlashColor = Color;
	FlashTimer = Duration;
	FlashDuration = FMath::Max(Duration, 0.01f);
}

// ---------------------------------------------------------------------------
//  Drawing helpers
// ---------------------------------------------------------------------------

float AMoteHUD::Scale() const
{
	return Canvas ? FMath::Min(Canvas->ClipX / RefW, Canvas->ClipY / RefH) : 1.f;
}

void AMoteHUD::Box(float X, float Y, float W, float H, const FLinearColor& Color)
{
	FCanvasTileItem Tile(FVector2D(X, Y), FVector2D(W, H), Color);
	Tile.BlendMode = SE_BLEND_AlphaBlend;
	Canvas->DrawItem(Tile);
}

/**
 * A slanted panel: the shape every fighting game cuts its life bars from.
 * Drawn as sheared rows of tiles - FCanvasTriangleItem needs a texture
 * resource that game modules cannot reach.
 */
void AMoteHUD::Slant(float X, float Y, float W, float H, float Skew, const FLinearColor& Color)
{
	const int32 Rows = FMath::Clamp(FMath::RoundToInt(H), 1, 400);
	const float RowH = H / Rows;
	for (int32 i = 0; i < Rows; ++i)
	{
		const float K = static_cast<float>(i) / Rows;          // 0 at the top
		const float Offset = Skew * (1.f - K);                 // lean the top edge over
		Box(X + Offset, Y + i * RowH, W, RowH + 1.f, Color);
	}
}

FVector2D AMoteHUD::Text(const FString& String, float X, float Y, float Size, const FLinearColor& Color,
	bool bCentre, bool bShadow, const TCHAR* Typeface)
{
	if (!Font)
	{
		return FVector2D::ZeroVector;
	}
	FSlateFontInfo Info(Font, FMath::RoundToInt(Size));
	Info.TypefaceFontName = FName(Typeface);

	FCanvasTextItem Item(FVector2D::ZeroVector, FText::FromString(String), Font, Color);
	Item.SlateFontInfo = Info;
	Item.BlendMode = SE_BLEND_Translucent;

	// Measure with the SAME font info we are about to draw with. Canvas->StrLen
	// uses the UFont's legacy metrics - the wrong typeface and the wrong size -
	// and rescaling its width by Size/LineHeight then undershoots by a third.
	// That put the "%" on top of the last digit and pushed every centred string
	// off centre.
	float W = 0.f, H = Size;
	if (FSlateApplication::IsInitialized())
	{
		const TSharedRef<FSlateFontMeasure> Measurer =
			FSlateApplication::Get().GetRenderer()->GetFontMeasureService();
		const FVector2D Measured(Measurer->Measure(String, Info));
		W = static_cast<float>(Measured.X);
		H = FMath::Max(static_cast<float>(Measured.Y), 1.f);
	}
	else
	{
		Canvas->StrLen(Font, String, W, H);
		const float Line = FMath::Max(H, 1.f);
		W *= Size / Line;
		H = Size;
	}

	const float DrawX = bCentre ? X - W * 0.5f : X;
	if (bShadow)
	{
		FCanvasTextItem Shade(FVector2D(DrawX + Size * 0.06f, Y + Size * 0.07f), FText::FromString(String), Font,
			FLinearColor(0.f, 0.f, 0.f, Color.A * 0.55f));
		Shade.SlateFontInfo = Info;
		Shade.BlendMode = SE_BLEND_Translucent;
		Canvas->DrawItem(Shade);
	}
	Item.Position = FVector2D(DrawX, Y);
	Canvas->DrawItem(Item);
	return FVector2D(W, H);
}

// ---------------------------------------------------------------------------
//  The fight HUD
// ---------------------------------------------------------------------------

void AMoteHUD::DrawFighterPanel(AMoteCharacter* Fighter, int32 Index, int32 Count)
{
	const float S = Scale();
	const FMoteFighterDef& Def = Fighter->GetFighterDef();

	const float PanelW = 400.f * S;
	const float PanelH = PanelBandH * S;
	const float Gap = 60.f * S;
	const float TotalW = Count * PanelW + (Count - 1) * Gap;
	const float X = (Canvas->ClipX - TotalW) * 0.5f + Index * (PanelW + Gap);
	float Y = Canvas->ClipY - PanelH - PanelBandInset * S;

	// Shake the whole panel when its fighter gets hit.
	const float ShakeAmount = PanelShake.FindRef(Fighter);
	const float Shake = ShakeAmount * 9.f * S;
	const float OffX = FMath::Sin(UiTime * 62.f) * Shake;
	Y += FMath::Cos(UiTime * 71.f) * Shake * 0.5f;

	const bool bOut = Fighter->GetStocks() <= 0;
	const FLinearColor Accent = Def.Accent;

	// Backing plate + accent stripe.
	Slant(X + OffX, Y, PanelW, PanelH, 22.f * S, FLinearColor(Ink.R, Ink.G, Ink.B, bOut ? 0.45f : 0.72f));
	Slant(X + OffX, Y, PanelW, 7.f * S, 22.f * S, Accent);

	// Name.
	Text(Def.DisplayName, X + OffX + 26.f * S, Y + 8.f * S, 28.f * S,
		bOut ? FLinearColor(0.6f, 0.6f, 0.62f) : Paper, false, true, TEXT("Bold"));

	// The number everyone watches.
	const float Percent = Fighter->GetPercent();
	const float Pop = 1.f + ShakeAmount * 0.16f;
	const FLinearColor Col = bOut ? FLinearColor(0.45f, 0.45f, 0.48f) : PercentColour(Percent);
	const FString Number = FString::Printf(TEXT("%d"), FMath::FloorToInt(Percent));
	const FVector2D NumSize = Text(Number, X + OffX + 26.f * S, Y + 40.f * S, 62.f * S * Pop, Col, false, true, TEXT("Black"));
	Text(TEXT("%"), X + OffX + 26.f * S + NumSize.X + 6.f * S, Y + 66.f * S, 28.f * S, Col, false, true, TEXT("Black"));

	// Stock pips: one per stock this match was started with, not a fixed five.
	// Hard-coding 5 made a full 3-stock bar read as "two lives already gone".
	const AMoteGameMode* GM = GetMoteGameMode();
	const int32 PipCount = FMath::Clamp(GM ? GM->GetMenu().Stocks : MoteTuning::DefaultStocks, 1, 9);
	const float PipR = 11.f * S;
	for (int32 i = 0; i < PipCount; ++i)
	{
		const bool bAlive = i < Fighter->GetStocks();
		const float PX = X + OffX + PanelW - 40.f * S - i * (PipR * 2.6f);
		const float PY = Y + 30.f * S;
		Box(PX - PipR, PY - PipR, PipR * 2.f, PipR * 2.f,
			bAlive ? Accent : FLinearColor(1.f, 1.f, 1.f, 0.14f));
	}

	// Respawn tag - only once the fight is actually under way. StartMatch parks
	// both fighters in KO so they can beam in during the intro, and an entrance
	// is not a respawn: without this gate every demo opened on "RESPAWNING".
	if (GM && GM->GetPhase() == EMoteMatchPhase::Fight
		&& Fighter->GetFighterState() == EMoteFighterState::KO && Fighter->GetStocks() > 0)
	{
		Text(TEXT("RESPAWNING"), X + OffX + PanelW - 70.f * S, Y + 88.f * S, 18.f * S,
			FLinearColor(1.f, 1.f, 1.f, 0.6f), true, true, TEXT("Bold"));
	}

	// Combo counter next to the attacker who is landing it.
	if (Fighter->GetComboCount() >= 2)
	{
		const FString Combo = FString::Printf(TEXT("%d HIT"), Fighter->GetComboCount());
		Text(Combo, X + OffX + PanelW * 0.5f, Y - 46.f * S, 40.f * S, Accent, true, true, TEXT("Black"));
	}
}

void AMoteHUD::DrawOffscreenMarkers(AMoteGameMode* GM)
{
	const float S = Scale();
	for (AMoteCharacter* F : GM->GetFighters())
	{
		if (!F || !F->IsActiveInMatch())
		{
			continue;
		}
		const FVector World = F->GetActorLocation();
		const FVector Screen = Project(World);
		const bool bBehind = Screen.Z <= 0.f;
		const bool bOff = bBehind || Screen.X < 0.f || Screen.X > Canvas->ClipX || Screen.Y < 0.f || Screen.Y > Canvas->ClipY;
		if (!bOff)
		{
			continue;
		}

		// Clamp the marker to the screen edge, pointing at them.
		FVector2D P(Screen.X, Screen.Y);
		if (bBehind)
		{
			P = FVector2D(Canvas->ClipX - Screen.X, Canvas->ClipY - Screen.Y);
		}
		const FVector2D Centre(Canvas->ClipX * 0.5f, Canvas->ClipY * 0.5f);
		FVector2D Dir = (P - Centre).GetSafeNormal();
		const float R = 30.f * S;
		const float Margin = 62.f * S;
		// The damage panels own the bottom-centre band and the markers are drawn
		// over them, so a bubble parked on the bottom edge landed square on a name
		// and a percent. The bottom edge gets its own margin - the panel band plus
		// the bubble radius plus a little air - so a marker for a fighter below the
		// stage rides along the top of the panels instead of through them.
		const float BottomMargin = (PanelBandH + PanelBandInset + 12.f) * S + R;
		const float MinX = Margin;
		const float MaxX = FMath::Max(Canvas->ClipX - Margin, MinX + 1.f);
		const float MinY = Margin;
		const float MaxY = FMath::Max(Canvas->ClipY - BottomMargin, MinY + 1.f);
		// Push along Dir until it meets the nearer of the two frame edges, so the
		// bubble actually hugs the border. Scaling each axis independently (as
		// this once did) leaves diagonal markers floating inside the frame. The
		// box is no longer centred on Centre, so each axis measures its own reach
		// in the direction we are travelling rather than one shared half-size.
		const float ReachX = FMath::Max((Dir.X >= 0.f) ? MaxX - Centre.X : Centre.X - MinX, 1.f);
		const float ReachY = FMath::Max((Dir.Y >= 0.f) ? MaxY - Centre.Y : Centre.Y - MinY, 1.f);
		const float TravelX = (FMath::Abs(Dir.X) > KINDA_SMALL_NUMBER) ? ReachX / FMath::Abs(Dir.X) : BIG_NUMBER;
		const float TravelY = (FMath::Abs(Dir.Y) > KINDA_SMALL_NUMBER) ? ReachY / FMath::Abs(Dir.Y) : BIG_NUMBER;
		const FVector2D Edge = Centre + Dir * FMath::Min(TravelX, TravelY);
		const FVector2D At(
			FMath::Clamp(Edge.X, MinX, MaxX),
			FMath::Clamp(Edge.Y, MinY, MaxY));

		Box(At.X - R, At.Y - R, R * 2.f, R * 2.f, FLinearColor(F->GetAccent().R, F->GetAccent().G, F->GetAccent().B, 0.85f));
		Text(FString::Printf(TEXT("%d"), FMath::FloorToInt(F->GetPercent())), At.X, At.Y - R * 0.55f, 26.f * S,
			Ink, true, false, TEXT("Black"));
	}
}

// ---------------------------------------------------------------------------
//  Screens
// ---------------------------------------------------------------------------

void AMoteHUD::DrawTitle(AMoteGameMode* GM)
{
	const float S = Scale();
	const float CX = Canvas->ClipX * 0.5f;

	Box(0, Canvas->ClipY * 0.16f, Canvas->ClipX, 260.f * S, FLinearColor(0.02f, 0.02f, 0.04f, 0.45f));
	Text(TEXT("MOTE"), CX, Canvas->ClipY * 0.17f, 150.f * S, Paper, true, true, TEXT("Black"));
	Text(TEXT("RUMBLE"), CX, Canvas->ClipY * 0.17f + 132.f * S, 150.f * S,
		FLinearColor(1.f, 0.72f, 0.24f), true, true, TEXT("Black"));
	Text(TEXT("A NOT TIM GAMES BRAWLER"), CX, Canvas->ClipY * 0.17f + 296.f * S, 26.f * S,
		FLinearColor(1.f, 1.f, 1.f, 0.75f), true, true, TEXT("Bold"));

	const float Blink = 0.55f + 0.45f * FMath::Sin(UiTime * 3.2f);
	Text(TEXT("PRESS ENTER"), CX, Canvas->ClipY * 0.74f, 44.f * S,
		FLinearColor(1.f, 1.f, 1.f, Blink), true, true, TEXT("Black"));
	Text(TEXT("WASD move    SPACE jump    H light    J heavy    K shield    L dodge    P pause"),
		CX, Canvas->ClipY - 54.f * S, 21.f * S, FLinearColor(1.f, 1.f, 1.f, 0.6f), true, true, TEXT("Regular"));
}

void AMoteHUD::DrawSelect(AMoteGameMode* GM)
{
	const float S = Scale();
	const FMoteMenuState& Menu = GM->GetMenu();
	const TArray<FMoteFighterDef>& Roster = FMoteRoster::All();

	Text(TEXT("CHOOSE YOUR MOTE"), Canvas->ClipX * 0.5f, 34.f * S, 44.f * S, Paper, true, true, TEXT("Black"));

	// 4 x 2 grid of cards down the bottom third.
	const float CardW = 210.f * S;
	const float CardH = 118.f * S;
	const float GapX = 18.f * S;
	const float GapY = 16.f * S;
	const float GridW = 4 * CardW + 3 * GapX;
	const float X0 = (Canvas->ClipX - GridW) * 0.5f;
	const float Y0 = Canvas->ClipY - 2 * CardH - GapY - 120.f * S;

	for (int32 i = 0; i < Roster.Num(); ++i)
	{
		const int32 Col = i % 4;
		const int32 Row = i / 4;
		const float X = X0 + Col * (CardW + GapX);
		const float Y = Y0 + Row * (CardH + GapY);
		const bool bP1 = (Menu.P1Cursor == i);
		const bool bRival = Menu.bP1Locked && (Menu.RivalCursor == i);

		Box(X, Y, CardW, CardH, FLinearColor(Ink.R, Ink.G, Ink.B, 0.72f));
		Box(X, Y, CardW, 6.f * S, Roster[i].Accent);
		Text(Roster[i].DisplayName, X + CardW * 0.5f, Y + 26.f * S, 34.f * S, Paper, true, true, TEXT("Black"));
		Text(Roster[i].Epithet, X + CardW * 0.5f, Y + 68.f * S, 16.f * S,
			FLinearColor(1.f, 1.f, 1.f, 0.65f), true, false, TEXT("Regular"));

		if (bP1 || bRival)
		{
			const float Pulse = 0.6f + 0.4f * FMath::Sin(UiTime * 7.f);
			const FLinearColor Ring = bP1 ? FLinearColor(1.f, 1.f, 1.f, Pulse) : FLinearColor(1.f, 0.4f, 0.4f, Pulse);
			const float T = 4.f * S;
			Box(X - T, Y - T, CardW + T * 2.f, T, Ring);
			Box(X - T, Y + CardH, CardW + T * 2.f, T, Ring);
			Box(X - T, Y, T, CardH, Ring);
			Box(X + CardW, Y, T, CardH, Ring);
			Text(bP1 ? TEXT("P1") : TEXT("CPU"), X + CardW * 0.5f, Y - 34.f * S, 24.f * S, Ring, true, true, TEXT("Black"));
		}
	}

	// Blurb and settings for the highlighted fighter.
	const int32 Focus = Menu.bP1Locked && Menu.RivalCursor >= 0 ? Menu.RivalCursor : Menu.P1Cursor;
	if (Roster.IsValidIndex(Focus))
	{
		const FMoteFighterDef& Def = Roster[Focus];
		Text(Def.Blurb, Canvas->ClipX * 0.5f, Y0 - 62.f * S, 22.f * S,
			FLinearColor(1.f, 1.f, 1.f, 0.85f), true, true, TEXT("Regular"));
	}

	const FString Rival = Menu.RivalCursor < 0 ? TEXT("RANDOM") : Roster[Menu.RivalCursor].DisplayName;
	const FString Line = Menu.bP1Locked
		? FString::Printf(TEXT("RIVAL: %s      CPU LEVEL %d      STOCKS %d"), *Rival, Menu.Difficulty, Menu.Stocks)
		: FString::Printf(TEXT("STOCKS %d      CPU LEVEL %d"), Menu.Stocks, Menu.Difficulty);
	Text(Line, Canvas->ClipX * 0.5f, Canvas->ClipY - 86.f * S, 24.f * S, Paper, true, true, TEXT("Bold"));
	Text(Menu.bP1Locked ? TEXT("LEFT/RIGHT rival    UP/DOWN cpu level    ENTER fight    BACKSPACE back")
		: TEXT("ARROWS choose    ENTER confirm    BACKSPACE back"),
		Canvas->ClipX * 0.5f, Canvas->ClipY - 48.f * S, 20.f * S, FLinearColor(1.f, 1.f, 1.f, 0.6f), true, true, TEXT("Regular"));
}

void AMoteHUD::DrawResults(AMoteGameMode* GM)
{
	const float S = Scale();
	const float CX = Canvas->ClipX * 0.5f;
	Box(0, 0, Canvas->ClipX, Canvas->ClipY, FLinearColor(0.f, 0.f, 0.f, 0.35f));

	AMoteCharacter* Winner = GM->GetWinner();
	const FLinearColor Accent = Winner ? Winner->GetAccent() : FLinearColor::White;
	Box(0, Canvas->ClipY * 0.14f, Canvas->ClipX, 150.f * S, FLinearColor(Accent.R, Accent.G, Accent.B, 0.22f));
	Text(Winner ? FString::Printf(TEXT("%s WINS"), *Winner->GetFighterDef().DisplayName) : TEXT("DRAW"),
		CX, Canvas->ClipY * 0.14f + 22.f * S, 96.f * S, Accent, true, true, TEXT("Black"));

	// Per-fighter stats.
	float Y = Canvas->ClipY * 0.42f;
	Text(TEXT("FIGHTER        KOs     FALLS    DAMAGE    BEST COMBO"), CX, Y, 24.f * S,
		FLinearColor(1.f, 1.f, 1.f, 0.7f), true, true, TEXT("Bold"));
	Y += 42.f * S;
	for (AMoteCharacter* F : GM->GetFighters())
	{
		if (!F) { continue; }
		const FString Row = FString::Printf(TEXT("%-12s   %2d       %2d      %4.0f%%        %2.0f"),
			*F->GetFighterDef().DisplayName, F->StatKOs, F->StatFalls, F->StatDamageDealt, F->StatMaxCombo);
		Text(Row, CX, Y, 28.f * S, F->GetAccent(), true, true, TEXT("Bold"));
		Y += 40.f * S;
	}

	const int32 Choice = GM->GetMenu().ResultsChoice;
	const float Pulse = 0.6f + 0.4f * FMath::Sin(UiTime * 6.f);
	Text(TEXT("REMATCH"), CX - 200.f * S, Canvas->ClipY * 0.8f, 40.f * S,
		Choice == 0 ? FLinearColor(1.f, 1.f, 1.f, Pulse) : FLinearColor(1.f, 1.f, 1.f, 0.4f), true, true, TEXT("Black"));
	Text(TEXT("CHANGE FIGHTERS"), CX + 220.f * S, Canvas->ClipY * 0.8f, 40.f * S,
		Choice == 1 ? FLinearColor(1.f, 1.f, 1.f, Pulse) : FLinearColor(1.f, 1.f, 1.f, 0.4f), true, true, TEXT("Black"));
}

void AMoteHUD::DrawPause(AMoteGameMode* GM)
{
	const float S = Scale();
	const float CX = Canvas->ClipX * 0.5f;
	Box(0, 0, Canvas->ClipX, Canvas->ClipY, FLinearColor(0.f, 0.f, 0.f, 0.55f));
	Text(TEXT("PAUSED"), CX, Canvas->ClipY * 0.3f, 88.f * S, Paper, true, true, TEXT("Black"));

	const TCHAR* Items[] = { TEXT("RESUME"), TEXT("RESTART"), TEXT("QUIT TO SELECT") };
	const int32 Choice = GM->GetMenu().PauseChoice;
	for (int32 i = 0; i < 3; ++i)
	{
		const bool bOn = (Choice == i);
		const float Pulse = 0.6f + 0.4f * FMath::Sin(UiTime * 6.f);
		Text(Items[i], CX, Canvas->ClipY * 0.46f + i * 64.f * S, 40.f * S,
			bOn ? FLinearColor(1.f, 1.f, 1.f, Pulse) : FLinearColor(1.f, 1.f, 1.f, 0.45f), true, true, TEXT("Black"));
	}
}

// ---------------------------------------------------------------------------

void AMoteHUD::DrawHUD()
{
	Super::DrawHUD();
	AMoteGameMode* GM = GetMoteGameMode();
	if (!GM || !Canvas || !Font)
	{
		return;
	}
	const float S = Scale();
	const EMoteMatchPhase Phase = GM->GetPhase();

	// ---- the fight ----
	const bool bFightHud = (Phase == EMoteMatchPhase::Countdown || Phase == EMoteMatchPhase::Fight
		|| Phase == EMoteMatchPhase::GameSet || Phase == EMoteMatchPhase::Intro);
	if (bFightHud)
	{
		const TArray<TObjectPtr<AMoteCharacter>>& Fighters = GM->GetFighters();
		for (int32 i = 0; i < Fighters.Num(); ++i)
		{
			if (Fighters[i])
			{
				DrawFighterPanel(Fighters[i], i, Fighters.Num());
			}
		}
		DrawOffscreenMarkers(GM);
	}

	// ---- screens ----
	switch (Phase)
	{
	case EMoteMatchPhase::Title:   DrawTitle(GM); break;
	case EMoteMatchPhase::Select:  DrawSelect(GM); break;
	case EMoteMatchPhase::Results: DrawResults(GM); break;
	default: break;
	}
	if (GM->IsPauseMenuOpen())
	{
		DrawPause(GM);
	}

	// ---- announcements ----
	for (const FMoteHudAnnouncement& A : Announcements)
	{
		const float T = FMath::Clamp(A.Age / FMath::Max(A.Duration, 0.01f), 0.f, 1.f);
		// Pop in, hold, fade out.
		const float Pop = (A.Age < 0.14f) ? FMath::Lerp(1.7f, 1.f, A.Age / 0.14f) : 1.f;
		const float Alpha = (T > 0.75f) ? 1.f - (T - 0.75f) / 0.25f : 1.f;
		const float Size = (A.Size >= 2 ? 150.f : A.Size == 1 ? 96.f : 60.f) * S * Pop;
		FLinearColor C = A.Color;
		C.A = Alpha;
		Text(A.Text, Canvas->ClipX * 0.5f, Canvas->ClipY * 0.3f - Size * 0.5f, Size, C, true, true, TEXT("Black"));
	}

	// ---- KO callout ----
	if (KOCalloutTimer > 0.f)
	{
		const float T = 1.f - KOCalloutTimer / 1.6f;
		const float Pop = (T < 0.12f) ? FMath::Lerp(2.2f, 1.f, T / 0.12f) : 1.f;
		FLinearColor C = KOCalloutColor;
		C.A = (T > 0.7f) ? 1.f - (T - 0.7f) / 0.3f : 1.f;
		Text(KOCalloutText, Canvas->ClipX * 0.5f, Canvas->ClipY * 0.44f, 128.f * S * Pop, C, true, true, TEXT("Black"));
	}

	// ---- screen flash ----
	if (FlashTimer > 0.f)
	{
		FLinearColor C = FlashColor;
		C.A = 0.55f * (FlashTimer / FlashDuration);
		Box(0, 0, Canvas->ClipX, Canvas->ClipY, C);
	}
}
