// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "MoteTypes.h"
#include "MoteGameMode.generated.h"

class AMoteArena;
class AMoteCharacter;
class AMoteCameraDirector;
class AMoteAIController;
struct FMoteKOEvent;
struct FMoteHitEvent;

/** The match flow. The HUD draws a different screen for each. */
UENUM(BlueprintType)
enum class EMoteMatchPhase : uint8
{
	Title,      // Logo + "press start"; two CPUs spar in the background
	Select,     // Fighter select (P1 picks, then the rival or Random)
	Intro,      // Camera sweep, fighters beam in
	Countdown,  // READY? 3 2 1 GO!
	Fight,
	GameSet,    // "GAME!" + slow-mo on the final KO
	Results     // Winner pose + stats; confirm to rematch, back to reselect
};

/** Select-screen state, read by the HUD. */
USTRUCT(BlueprintType)
struct FMoteMenuState
{
	GENERATED_BODY()

	/** Index into FMoteRoster::All() under the P1 cursor. */
	UPROPERTY(BlueprintReadOnly) int32 P1Cursor = 0;
	UPROPERTY(BlueprintReadOnly) bool bP1Locked = false;
	/** Rival cursor; -1 = Random. Only used once P1 has locked in. */
	UPROPERTY(BlueprintReadOnly) int32 RivalCursor = -1;
	UPROPERTY(BlueprintReadOnly) bool bRivalLocked = false;
	/** CPU level 1..9. */
	UPROPERTY(BlueprintReadOnly) int32 Difficulty = 5;
	UPROPERTY(BlueprintReadOnly) int32 Stocks = 3;
	/** Results screen: 0 = Rematch, 1 = Change fighters. */
	UPROPERTY(BlueprintReadOnly) int32 ResultsChoice = 0;
	/** Pause menu: 0 = Resume, 1 = Restart, 2 = Quit to select. */
	UPROPERTY(BlueprintReadOnly) int32 PauseChoice = 0;
};

/**
 * Runs the match: spawns the arena, fighters and camera; owns stocks, blast
 * zones, respawns, slow-mo, music and the menu flow. Also hosts the demo
 * (-MoteDemo: CPU vs CPU forever, no menus) and recording (-MoteRecord=SECS)
 * modes used to make trailers.
 *
 * Command line:
 *   -MoteDemo            skip menus, CPU vs CPU, loop matches
 *   -P1=Blade -P2=Maul   choose fighters (with -MoteDemo or -MoteQuick)
 *   -MoteQuick           skip title/select straight into a match vs CPU
 *   -MoteRecord=30       fixed 60 fps, dump every frame to Recordings/frames,
 *                        log audio cues, quit after 30 s of match time
 *   -MoteShots           save a screenshot every 2 s (visual QA)
 *   -MoteLevel=7         CPU difficulty
 *   -MoteQuitAfter=40    exit after 40 real seconds (automated runs)
 *   -MoteSeed=123        fixed random seed
 */
UCLASS()
class MOTERUMBLE_API AMoteGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AMoteGameMode();

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	// ---- queries (HUD, camera, AI) ------------------------------------------------
	EMoteMatchPhase GetPhase() const { return Phase; }
	/** Real seconds since the phase began. */
	float GetPhaseTime() const { return PhaseTime; }
	/** Countdown display value: 3, 2, 1, then 0 for "GO!". -1 outside the countdown. */
	int32 GetCountdownNumber() const;
	const TArray<TObjectPtr<AMoteCharacter>>& GetFighters() const { return Fighters; }
	AMoteArena* GetArena() const { return Arena; }
	AMoteCameraDirector* GetCameraDirector() const { return CameraDirector; }
	const FMoteMenuState& GetMenu() const { return Menu; }
	AMoteCharacter* GetWinner() const { return Winner; }
	bool IsPauseMenuOpen() const { return bPaused; }
	bool IsDemoMode() const { return bDemoMode; }
	bool IsRecording() const { return RecordSeconds > 0.f; }
	/** Index of the frame the recorder writes next - lets debug logs point at an exact PNG. */
	int32 GetRecordFrame() const { return RecordFrame; }
	/** Seconds of Fight phase elapsed. */
	float GetMatchTime() const { return MatchTime; }
	/** The human player's fighter (nullptr in demo mode). */
	AMoteCharacter* GetPlayerFighter() const;
	/** Opponents of Fighter still in play (for AI targeting). */
	void GetOpponents(const AMoteCharacter* Fighter, TArray<AMoteCharacter*>& Out) const;

	// ---- menu input (from AMotePlayerController) --------------------------------
	void MenuNavigate(int32 DX, int32 DY);
	void MenuConfirm();
	void MenuBack();
	void TogglePause();

	// ---- gameplay hooks -----------------------------------------------------------
	/** Real-time slow motion: dilation applies for RealSeconds, then eases back. */
	void SetSlowMo(float Dilation, float RealSeconds);

protected:
	void SetPhase(EMoteMatchPhase NewPhase);
	void EnterTitle();
	void EnterSelect();
	/** Keep the two select-screen display models in sync with the cursors. */
	void UpdateSelectPreview();
	void SpawnArena();
	void SpawnCamera();
	AMoteCharacter* SpawnFighter(int32 Index, EMoteCore Core, bool bCPU, int32 Level);
	void ClearFighters();
	/** Build the two fighters for a match from Menu/command line and start the intro. */
	void StartMatch(EMoteCore P1, EMoteCore P2, bool bP1IsCPU);
	void StartBackgroundSpar();
	void TickFight(float Dt);
	void HandleKO(AMoteCharacter* Victim);
	void CheckForWinner();
	void TickSlowMo(float RealDt);
	void TickRecording(float RealDt);
	void OnHitEvent(const FMoteHitEvent& Event);
	void UpdateMusic();

	UPROPERTY() TObjectPtr<AMoteArena> Arena;
	UPROPERTY() TObjectPtr<AMoteCameraDirector> CameraDirector;
	UPROPERTY() TArray<TObjectPtr<AMoteCharacter>> Fighters;
	UPROPERTY() TArray<TObjectPtr<AMoteAIController>> Brains;
	UPROPERTY() TObjectPtr<AMoteCharacter> Winner;

	EMoteMatchPhase Phase = EMoteMatchPhase::Title;
	float PhaseTime = 0.f;
	/** Index of the next one-shot cue within the current phase. */
	int32 PhaseCue = 0;
	/** Last match setup, for Rematch/Restart. */
	EMoteCore LastP1 = EMoteCore::Blade;
	EMoteCore LastP2 = EMoteCore::Maul;
	bool bLastP1CPU = false;
	float MatchTime = 0.f;
	FMoteMenuState Menu;
	bool bPaused = false;
	bool bFinalKOPending = false;
	FName CurrentMusic;

	// Respawn bookkeeping: fighter -> seconds until they reappear.
	TMap<TWeakObjectPtr<AMoteCharacter>, float> RespawnTimers;

	// Slow-mo
	float SlowMoDilation = 1.f;
	float SlowMoTimer = 0.f;

	// Modes
	bool bDemoMode = false;
	bool bQuickMode = false;
	bool bShotsMode = false;
	float ShotTimer = 0.f;
	int32 ShotIndex = 0;
	float RecordSeconds = 0.f;
	int32 RecordFrame = 0;
	int32 CmdLevel = 5;
	EMoteCore CmdP1 = EMoteCore::Count;
	EMoteCore CmdP2 = EMoteCore::Count;
	int32 DemoMatchCount = 0;
	float QuitAfterSeconds = 0.f;
	float QuitClock = 0.f;

	FDelegateHandle HitHandle;
};
