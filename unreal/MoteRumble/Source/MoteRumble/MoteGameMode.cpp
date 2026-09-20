// Copyright Not Tim Games. All Rights Reserved.

#include "MoteGameMode.h"

#include "MoteAIController.h"
#include "MoteArena.h"
#include "MoteAudio.h"
#include "MoteCameraDirector.h"
#include "MoteCharacter.h"
#include "MoteEvents.h"
#include "MoteFX.h"
#include "MoteHUD.h"
#include "MotePlayerController.h"

#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "EngineUtils.h"
#include "HAL/FileManager.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/App.h"
#include "Misc/CommandLine.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"

namespace
{
	constexpr float IntroSeconds = 2.6f;
	constexpr float CountdownStart = 1.0f;   // "READY?" runs until the 3
	constexpr float CountdownStep = 0.62f;   // 3 .. 2 .. 1 .. GO
	constexpr float GameSetSeconds = 3.0f;
	constexpr float DemoResultsSeconds = 5.5f;

	FString CoreSoundName(EMoteCore Core)
	{
		return FString::Printf(TEXT("vo_%s"), *FMoteRoster::Get(Core).DisplayName.ToLower());
	}
}

AMoteGameMode::AMoteGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bTickEvenWhenPaused = true;
	DefaultPawnClass = nullptr;
	PlayerControllerClass = AMotePlayerController::StaticClass();
	HUDClass = AMoteHUD::StaticClass();
}

void AMoteGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);

	const TCHAR* Cmd = FCommandLine::Get();
	bDemoMode = FParse::Param(Cmd, TEXT("MoteDemo"));
	bQuickMode = FParse::Param(Cmd, TEXT("MoteQuick"));
	bShotsMode = FParse::Param(Cmd, TEXT("MoteShots"));
	FParse::Value(Cmd, TEXT("MoteRecord="), RecordSeconds);
	FParse::Value(Cmd, TEXT("MoteLevel="), CmdLevel);
	FParse::Value(Cmd, TEXT("MoteQuitAfter="), QuitAfterSeconds);
	CmdLevel = FMath::Clamp(CmdLevel, 1, 9);

	FString P1, P2;
	if (FParse::Value(Cmd, TEXT("P1="), P1)) { CmdP1 = FMoteRoster::FromName(P1, EMoteCore::Count); }
	if (FParse::Value(Cmd, TEXT("P2="), P2)) { CmdP2 = FMoteRoster::FromName(P2, EMoteCore::Count); }

	int32 Seed = 0;
	if (FParse::Value(Cmd, TEXT("MoteSeed="), Seed))
	{
		FMath::RandInit(Seed);
		FMath::SRandInit(Seed);
	}

	if (RecordSeconds > 0.f)
	{
		// Deterministic 60 fps capture regardless of how long each frame takes to encode.
		bDemoMode = true;
		FApp::SetUseFixedTimeStep(true);
		FApp::SetFixedDeltaTime(1.0 / 60.0);
	}
}

void AMoteGameMode::StartPlay()
{
	// The floor must exist before anything spawns onto it.
	SpawnArena();
	Super::StartPlay();
	SpawnCamera();

	HitHandle = UMoteEventHub::Get(this)->OnHit.AddUObject(this, &AMoteGameMode::OnHitEvent);

	if (IsRecording())
	{
		if (UMoteAudio* Audio = UMoteAudio::Get(this))
		{
			Audio->BeginCueLog();
		}
		const FString Dir = FPaths::ProjectDir() / TEXT("Recordings/frames");
		IFileManager::Get().DeleteDirectory(*Dir, false, true);
		IFileManager::Get().MakeDirectory(*Dir, true);
	}

	if (bDemoMode)
	{
		const EMoteCore A = (CmdP1 != EMoteCore::Count) ? CmdP1 : FMoteRoster::RandomCore();
		const EMoteCore B = (CmdP2 != EMoteCore::Count) ? CmdP2 : FMoteRoster::RandomCore(A);
		Menu.Difficulty = CmdLevel;
		StartMatch(A, B, true);
	}
	else if (bQuickMode)
	{
		const EMoteCore A = (CmdP1 != EMoteCore::Count) ? CmdP1 : EMoteCore::Blade;
		const EMoteCore B = (CmdP2 != EMoteCore::Count) ? CmdP2 : FMoteRoster::RandomCore(A);
		Menu.Difficulty = CmdLevel;
		StartMatch(A, B, false);
	}
	else
	{
		EnterTitle();
	}
}

void AMoteGameMode::EndPlay(const EEndPlayReason::Type Reason)
{
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		Hub->OnHit.Remove(HitHandle);
	}
	Super::EndPlay(Reason);
}

// ============================================================================
//  Spawning
// ============================================================================

void AMoteGameMode::SpawnArena()
{
	UWorld* World = GetWorld();
	if (!World || Arena)
	{
		return;
	}
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Arena = World->SpawnActor<AMoteArena>(AMoteArena::StaticClass(), FTransform::Identity, Params);
}

void AMoteGameMode::SpawnCamera()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	CameraDirector = World->SpawnActor<AMoteCameraDirector>(AMoteCameraDirector::StaticClass(),
		FVector(-3000.f, 0.f, 1500.f), FRotator(-25.f, 0.f, 0.f), Params);

	for (FConstPlayerControllerIterator It = World->GetPlayerControllerIterator(); It; ++It)
	{
		if (APlayerController* PC = It->Get())
		{
			PC->SetViewTarget(CameraDirector);
		}
	}
}

AMoteCharacter* AMoteGameMode::SpawnFighter(int32 Index, EMoteCore Core, bool bCPU, int32 Level)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}
	FVector Loc(0.f, 0.f, 200.f);
	float Yaw = 0.f;
	if (Arena)
	{
		Arena->GetSpawnPoint(Index, 2, Loc, Yaw);
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AMoteCharacter* Fighter = World->SpawnActor<AMoteCharacter>(AMoteCharacter::StaticClass(), Loc, FRotator(0.f, Yaw, 0.f), Params);
	if (!Fighter)
	{
		return nullptr;
	}
	Fighter->SetPlayerIndex(Index);
	Fighter->SetIsCPU(bCPU);
	Fighter->SetFighter(Core);
	Fighter->SetStocks(Menu.Stocks);
	Fighter->ResetForMatch(Loc, Yaw);

	if (bCPU)
	{
		if (AMoteAIController* Brain = World->SpawnActor<AMoteAIController>(AMoteAIController::StaticClass()))
		{
			Brain->SetLevel(Level);
			Brain->Possess(Fighter);
			Brains.Add(Brain);
		}
	}
	else if (APlayerController* PC = World->GetFirstPlayerController())
	{
		PC->Possess(Fighter);
		if (CameraDirector)
		{
			PC->SetViewTarget(CameraDirector);
		}
	}

	Fighters.Add(Fighter);
	return Fighter;
}

void AMoteGameMode::ClearFighters()
{
	if (APlayerController* PC = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr)
	{
		PC->UnPossess();
		if (CameraDirector)
		{
			PC->SetViewTarget(CameraDirector);
		}
	}
	for (AMoteAIController* Brain : Brains)
	{
		if (Brain)
		{
			Brain->UnPossess();
			Brain->Destroy();
		}
	}
	Brains.Reset();
	for (AMoteCharacter* F : Fighters)
	{
		if (F)
		{
			F->Destroy();
		}
	}
	Fighters.Reset();
	RespawnTimers.Reset();
	Winner = nullptr;
	if (Arena)
	{
		for (int32 i = 0; i < 4; ++i)
		{
			Arena->ShowRespawnHalo(i, FVector::ZeroVector, FLinearColor::White, false);
		}
	}
	UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
	SlowMoTimer = 0.f;
	SlowMoDilation = 1.f;
}

// ============================================================================
//  Phases
// ============================================================================

void AMoteGameMode::SetPhase(EMoteMatchPhase NewPhase)
{
	Phase = NewPhase;
	PhaseTime = 0.f;
	PhaseCue = 0;
	UpdateMusic();
}

void AMoteGameMode::EnterTitle()
{
	ClearFighters();
	bPaused = false;
	SetPhase(EMoteMatchPhase::Title);
	StartBackgroundSpar();
	if (CameraDirector)
	{
		CameraDirector->SetMode(EMoteCamMode::Title);
		CameraDirector->SnapNextFrame();
	}
}

void AMoteGameMode::StartBackgroundSpar()
{
	// Two CPUs duel behind the title screen with endless stocks.
	const EMoteCore A = FMoteRoster::RandomCore();
	const EMoteCore B = FMoteRoster::RandomCore(A);
	const int32 SavedStocks = Menu.Stocks;
	Menu.Stocks = 99;
	SpawnFighter(0, A, true, 6);
	SpawnFighter(1, B, true, 6);
	Menu.Stocks = SavedStocks;
}

void AMoteGameMode::EnterSelect()
{
	ClearFighters();
	bPaused = false;
	Menu.bP1Locked = false;
	Menu.bRivalLocked = false;
	SetPhase(EMoteMatchPhase::Select);

	// Two display models: the P1 pick (centre-left) and the rival pick (right).
	for (int32 i = 0; i < 2; ++i)
	{
		const EMoteCore Core = (i == 0) ? static_cast<EMoteCore>(Menu.P1Cursor) : FMoteRoster::RandomCore();
		if (AMoteCharacter* F = SpawnFighter(i, Core, true, 1))
		{
			// Display only: no brain, no controls.
			if (AController* C = F->GetController())
			{
				C->UnPossess();
			}
			F->SetControlsLocked(true);
		}
	}
	for (AMoteAIController* Brain : Brains)
	{
		if (Brain) { Brain->Destroy(); }
	}
	Brains.Reset();
	UpdateSelectPreview();
	if (CameraDirector)
	{
		CameraDirector->SetMode(EMoteCamMode::Select, Fighters.Num() > 0 ? Fighters[0].Get() : nullptr);
		CameraDirector->SnapNextFrame();
	}
}

void AMoteGameMode::UpdateSelectPreview()
{
	if (Fighters.Num() < 2)
	{
		return;
	}
	AMoteCharacter* P1 = Fighters[0];
	AMoteCharacter* Rival = Fighters[1];

	const EMoteCore P1Core = static_cast<EMoteCore>(Menu.P1Cursor);
	if (P1 && P1->GetCore() != P1Core)
	{
		P1->SetFighter(P1Core);
	}
	if (P1)
	{
		// Face the camera (which sits on the -X side).
		P1->ResetForMatch(FVector(0.f, Menu.bP1Locked ? -170.f : 0.f, 120.f), 180.f);
		P1->SetControlsLocked(true);
	}

	if (Rival)
	{
		const bool bShowRival = Menu.bP1Locked && Menu.RivalCursor >= 0;
		if (bShowRival)
		{
			const EMoteCore RivalCore = static_cast<EMoteCore>(Menu.RivalCursor);
			if (Rival->GetCore() != RivalCore)
			{
				Rival->SetFighter(RivalCore);
			}
			Rival->ResetForMatch(FVector(0.f, 170.f, 120.f), 180.f);
			Rival->SetControlsLocked(true);
		}
		else
		{
			Rival->ResetForMatch(FVector(0.f, 170.f, -5000.f), 180.f);
			Rival->EnterKO();
		}
	}
}

void AMoteGameMode::StartMatch(EMoteCore P1, EMoteCore P2, bool bP1IsCPU)
{
	ClearFighters();
	bPaused = false;
	UGameplayStatics::SetGamePaused(this, false);
	LastP1 = P1;
	LastP2 = P2;
	bLastP1CPU = bP1IsCPU;
	MatchTime = 0.f;
	bFinalKOPending = false;

	const int32 Level = Menu.Difficulty;
	SpawnFighter(0, P1, bP1IsCPU, bP1IsCPU ? FMath::Clamp(Level + 1, 1, 9) : Level);
	SpawnFighter(1, P2, true, Level);

	for (AMoteCharacter* F : Fighters)
	{
		F->SetControlsLocked(true);
		F->SetStocks(Menu.Stocks);
		// They beam in during the intro.
		F->EnterKO();
		F->StatFalls = 0;
	}

	SetPhase(EMoteMatchPhase::Intro);
	if (CameraDirector)
	{
		CameraDirector->SetMode(EMoteCamMode::Intro);
		CameraDirector->SnapNextFrame();
	}
}

int32 AMoteGameMode::GetCountdownNumber() const
{
	if (Phase != EMoteMatchPhase::Countdown)
	{
		return -1;
	}
	if (PhaseTime < CountdownStart)
	{
		return 4;  // "READY?"
	}
	const int32 Step = FMath::FloorToInt((PhaseTime - CountdownStart) / CountdownStep);
	return FMath::Max(0, 3 - Step);
}

AMoteCharacter* AMoteGameMode::GetPlayerFighter() const
{
	for (AMoteCharacter* F : Fighters)
	{
		if (F && !F->IsCPU())
		{
			return F;
		}
	}
	return nullptr;
}

void AMoteGameMode::GetOpponents(const AMoteCharacter* Fighter, TArray<AMoteCharacter*>& Out) const
{
	Out.Reset();
	for (AMoteCharacter* F : Fighters)
	{
		if (F && F != Fighter && F->IsActiveInMatch())
		{
			Out.Add(F);
		}
	}
}

// ============================================================================
//  Tick
// ============================================================================

void AMoteGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Phase timers run on real time so slow-mo doesn't stretch menus/banners.
	const float RealDt = FApp::GetDeltaTime();
	TickSlowMo(RealDt);

	// -MoteQuitAfter=N: exit on our own (automated test runs).
	if (QuitAfterSeconds > 0.f)
	{
		QuitClock += RealDt;
		if (QuitClock >= QuitAfterSeconds)
		{
			QuitAfterSeconds = 0.f;
			if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
			{
				PC->ConsoleCommand(TEXT("quit"));
			}
		}
	}
	TickRecording(RealDt);

	if (bPaused)
	{
		return;
	}
	PhaseTime += RealDt;

	UMoteEventHub* Hub = UMoteEventHub::Get(this);
	UMoteAudio* Audio = UMoteAudio::Get(this);
	auto Cue = [this](int32 Index, float At) -> bool
	{
		// Fire once when PhaseTime crosses At (cues must be checked in order).
		if (PhaseCue == Index && PhaseTime >= At)
		{
			++PhaseCue;
			return true;
		}
		return false;
	};

	switch (Phase)
	{
	case EMoteMatchPhase::Title:
	case EMoteMatchPhase::Select:
		// Background sparring: KOs just respawn.
		if (Phase == EMoteMatchPhase::Title)
		{
			TickFight(DeltaSeconds);
		}
		break;

	case EMoteMatchPhase::Intro:
	{
		// Fighters beam onto their start spots one after the other.
		for (int32 i = 0; i < Fighters.Num(); ++i)
		{
			if (Cue(i, 0.35f + 0.55f * i) && Fighters[i])
			{
				FVector Loc; float Yaw;
				Arena->GetSpawnPoint(i, Fighters.Num(), Loc, Yaw);
				Fighters[i]->ResetForMatch(Loc, Yaw);
				Fighters[i]->SetControlsLocked(true);
				if (UMoteFX* FX = UMoteFX::Get(this))
				{
					FX->RespawnBeam(Loc - FVector(0.f, 0.f, 60.f), Fighters[i]->GetAccent());
				}
				if (Audio)
				{
					Audio->Play(TEXT("sfx_respawn"), 0.8f);
					Audio->Play(*CoreSoundName(Fighters[i]->GetCore()), 0.9f);
				}
			}
		}
		if (PhaseTime >= IntroSeconds)
		{
			SetPhase(EMoteMatchPhase::Countdown);
			if (CameraDirector)
			{
				CameraDirector->SetMode(EMoteCamMode::Gameplay);
			}
		}
		break;
	}

	case EMoteMatchPhase::Countdown:
	{
		if (Cue(0, 0.f))
		{
			if (Hub) { Hub->Announce(TEXT("READY?"), FLinearColor(1.f, 0.85f, 0.3f), CountdownStart, 1); }
			if (Audio) { Audio->Play(TEXT("vo_ready"), 1.f); }
		}
		for (int32 n = 0; n < 3; ++n)
		{
			if (Cue(1 + n, CountdownStart + CountdownStep * n))
			{
				if (Hub) { Hub->Announce(FString::FromInt(3 - n), FLinearColor::White, CountdownStep, 2); }
				if (Audio) { Audio->Play(TEXT("sfx_countdown"), 0.8f); }
			}
		}
		if (Cue(4, CountdownStart + CountdownStep * 3))
		{
			if (Hub)
			{
				Hub->Announce(TEXT("GO!"), FLinearColor(1.f, 0.55f, 0.15f), 0.9f, 2);
				Hub->Flash(FLinearColor(1.f, 0.95f, 0.8f), 0.18f);
			}
			if (Audio)
			{
				Audio->Play(TEXT("vo_go"), 1.f);
				Audio->Play(TEXT("sfx_go"), 0.9f);
			}
			for (AMoteCharacter* F : Fighters)
			{
				if (F) { F->SetControlsLocked(false); }
			}
			SetPhase(EMoteMatchPhase::Fight);
		}
		break;
	}

	case EMoteMatchPhase::Fight:
		MatchTime += DeltaSeconds;
		TickFight(DeltaSeconds);
		break;

	case EMoteMatchPhase::GameSet:
		if (Cue(0, 0.f))
		{
			if (Hub)
			{
				Hub->Announce(TEXT("GAME!"), FLinearColor(1.f, 0.3f, 0.2f), 2.4f, 2);
				Hub->Flash(FLinearColor::White, 0.25f);
			}
			if (Audio) { Audio->Play(TEXT("vo_game"), 1.f); }
		}
		if (PhaseTime >= GameSetSeconds)
		{
			SetPhase(EMoteMatchPhase::Results);
			UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
			SlowMoTimer = 0.f;
			for (AMoteCharacter* F : Fighters)
			{
				if (!F) { continue; }
				if (F == Winner)
				{
					F->ResetForMatch(FVector(0.f, 0.f, 120.f), 180.f);
					F->SetControlsLocked(true);
					F->EnterVictory();
				}
				else
				{
					F->EnterKO();
				}
			}
			if (CameraDirector)
			{
				CameraDirector->SetMode(EMoteCamMode::Victory, Winner);
				CameraDirector->SnapNextFrame();
			}
		}
		break;

	case EMoteMatchPhase::Results:
		if (Cue(0, 0.4f) && Audio) { Audio->Play(TEXT("vo_the_winner_is"), 1.f); }
		if (Cue(1, 1.5f) && Audio && Winner) { Audio->Play(*CoreSoundName(Winner->GetCore()), 1.f); }
		if (bDemoMode && PhaseTime >= DemoResultsSeconds)
		{
			++DemoMatchCount;
			const EMoteCore A = FMoteRoster::RandomCore();
			StartMatch(A, FMoteRoster::RandomCore(A), true);
		}
		break;
	}

	// Shots mode: periodic screenshots for visual QA.
	if (bShotsMode)
	{
		ShotTimer += RealDt;
		if (ShotTimer >= 2.f)
		{
			ShotTimer = 0.f;
			const FString Path = FPaths::ProjectSavedDir() / FString::Printf(TEXT("Shots/shot_%03d.png"), ShotIndex++);
			FScreenshotRequest::RequestScreenshot(Path, true, false);
		}
	}
}

void AMoteGameMode::TickFight(float Dt)
{
	if (!Arena)
	{
		return;
	}

	// -MoteDebug: dump where everything actually is, once a second.
	static float DebugClock = 0.f;
	if (FParse::Param(FCommandLine::Get(), TEXT("MoteDebug")))
	{
		DebugClock += Dt;
		if (DebugClock >= 1.f)
		{
			DebugClock = 0.f;
			for (AMoteCharacter* F : Fighters)
			{
				if (F)
				{
					UE_LOG(LogTemp, Warning, TEXT("MOTEDBG fighter %s loc=%s grounded=%d state=%d"),
						*F->GetFighterDef().DisplayName, *F->GetActorLocation().ToCompactString(),
						F->IsGrounded() ? 1 : 0, static_cast<int32>(F->GetFighterState()));
				}
			}
			if (CameraDirector)
			{
				UE_LOG(LogTemp, Warning, TEXT("MOTEDBG camera loc=%s rot=%s"),
					*CameraDirector->GetActorLocation().ToCompactString(),
					*CameraDirector->GetActorRotation().ToCompactString());
			}
			UE_LOG(LogTemp, Warning, TEXT("MOTEDBG arena bounds=%s"), *Arena->GetComponentsBoundingBox(true).ToString());
		}
	}

	// Blast zones.
	for (AMoteCharacter* F : Fighters)
	{
		if (!F)
		{
			continue;
		}
		const EMoteFighterState S = F->GetFighterState();
		if (S == EMoteFighterState::KO || S == EMoteFighterState::Inactive || S == EMoteFighterState::Respawning
			|| S == EMoteFighterState::Victory)
		{
			continue;
		}
		if (Arena->IsOutsideBlastZone(F->GetActorLocation()))
		{
			HandleKO(F);
		}
	}

	// Respawns (real-ish time: dilation matters little here).
	for (auto It = RespawnTimers.CreateIterator(); It; ++It)
	{
		It.Value() -= Dt;
		if (It.Value() <= 0.f)
		{
			if (AMoteCharacter* F = It.Key().Get())
			{
				const FVector Halo = Arena->GetRespawnPoint(F->GetPlayerIndex(), Fighters.Num());
				Arena->ShowRespawnHalo(F->GetPlayerIndex(), Halo - FVector(0.f, 0.f, 70.f), F->GetAccent(), true);
				F->BeginRespawn(Halo, F->GetPlayerIndex() == 0 ? 0.f : 180.f);
			}
			It.RemoveCurrent();
		}
	}
}

void AMoteGameMode::HandleKO(AMoteCharacter* Victim)
{
	const FVector Where = Victim->GetActorLocation();
	FVector Inward = -Where;
	Inward = Inward.GetSafeNormal();
	if (Inward.IsNearlyZero())
	{
		Inward = FVector::UpVector;
	}

	const bool bCounting = (Phase == EMoteMatchPhase::Fight);
	int32 Stocks = Victim->GetStocks();
	if (bCounting)
	{
		Stocks = FMath::Max(0, Stocks - 1);
		Victim->SetStocks(Stocks);
		if (AMoteCharacter* Killer = Victim->GetLastAttacker())
		{
			if (Killer != Victim)
			{
				++Killer->StatKOs;
			}
		}
	}
	Victim->EnterKO();

	// Clamp the blast to somewhere the camera can see.
	FVector Visible = Where;
	const float Side = Arena->GetBlastSideRadius() - 300.f;
	FVector H(Visible.X, Visible.Y, 0.f);
	if (H.Size() > Side) { H = H.GetSafeNormal() * Side; }
	Visible.X = H.X;
	Visible.Y = H.Y;
	Visible.Z = FMath::Clamp(Visible.Z, Arena->GetBlastBottom() + 400.f, Arena->GetBlastTop() - 300.f);

	if (UMoteFX* FX = UMoteFX::Get(this))
	{
		FX->KOBlast(Visible, Inward, Victim->GetAccent());
	}
	if (UMoteAudio* Audio = UMoteAudio::Get(this))
	{
		Audio->Play(TEXT("sfx_ko_blast"), 1.f);
	}

	const bool bFinal = bCounting && Stocks <= 0;
	if (UMoteEventHub* Hub = UMoteEventHub::Get(this))
	{
		FMoteKOEvent E;
		E.Victim = Victim;
		E.LastAttacker = Victim->GetLastAttacker();
		E.Location = Visible;
		E.InwardDirection = Inward;
		E.StocksLeft = Stocks;
		E.bFinal = bFinal;
		Hub->OnKO.Broadcast(E);
		Hub->Flash(Victim->GetAccent(), 0.22f);
		Hub->Impact(Visible, 1.6f);
	}

	if (bFinal)
	{
		CheckForWinner();
	}
	else
	{
		RespawnTimers.Add(Victim, MoteTuning::RespawnDelay);
	}
}

void AMoteGameMode::CheckForWinner()
{
	TArray<AMoteCharacter*> Alive;
	for (AMoteCharacter* F : Fighters)
	{
		if (F && F->GetStocks() > 0)
		{
			Alive.Add(F);
		}
	}
	if (Alive.Num() > 1)
	{
		return;
	}
	Winner = Alive.Num() == 1 ? Alive[0] : nullptr;
	for (AMoteCharacter* F : Fighters)
	{
		if (F) { F->SetControlsLocked(true); }
	}
	RespawnTimers.Reset();
	SetPhase(EMoteMatchPhase::GameSet);
	SetSlowMo(0.25f, 1.2f);
}

void AMoteGameMode::OnHitEvent(const FMoteHitEvent& Event)
{
	if (Phase != EMoteMatchPhase::Fight || !Event.bLethal || !Event.Victim.IsValid())
	{
		return;
	}
	// The hit that will end the game: freeze-frame drama.
	if (Event.Victim->GetStocks() <= 1)
	{
		SetSlowMo(0.12f, 0.9f);
		if (CameraDirector)
		{
			CameraDirector->SetMode(EMoteCamMode::FinalHit, Event.Victim.Get());
		}
		bFinalKOPending = true;
	}
	else
	{
		SetSlowMo(0.45f, 0.25f);
	}
}

// ============================================================================
//  Slow motion & recording
// ============================================================================

void AMoteGameMode::SetSlowMo(float Dilation, float RealSeconds)
{
	SlowMoDilation = FMath::Clamp(Dilation, 0.05f, 1.f);
	SlowMoTimer = RealSeconds;
	UGameplayStatics::SetGlobalTimeDilation(this, SlowMoDilation);
}

void AMoteGameMode::TickSlowMo(float RealDt)
{
	if (SlowMoTimer <= 0.f)
	{
		return;
	}
	SlowMoTimer -= RealDt;
	if (SlowMoTimer <= 0.f)
	{
		SlowMoTimer = 0.f;
		UGameplayStatics::SetGlobalTimeDilation(this, 1.f);
		if (bFinalKOPending && Phase == EMoteMatchPhase::Fight && CameraDirector)
		{
			CameraDirector->SetMode(EMoteCamMode::Gameplay);
		}
		bFinalKOPending = false;
	}
	else if (SlowMoTimer < 0.3f)
	{
		// Ease back to full speed.
		const float A = 1.f - SlowMoTimer / 0.3f;
		UGameplayStatics::SetGlobalTimeDilation(this, FMath::Lerp(SlowMoDilation, 1.f, A));
	}
}

void AMoteGameMode::TickRecording(float RealDt)
{
	if (!IsRecording())
	{
		return;
	}
	const double Clock = RecordFrame / 60.0;
	if (UMoteAudio* Audio = UMoteAudio::Get(this))
	{
		Audio->SetCueClock(Clock);
	}
	const FString Path = FPaths::ProjectDir() / FString::Printf(TEXT("Recordings/frames/frame_%05d.png"), RecordFrame);
	FScreenshotRequest::RequestScreenshot(Path, true, false);
	++RecordFrame;

	if (Clock >= RecordSeconds)
	{
		if (UMoteAudio* Audio = UMoteAudio::Get(this))
		{
			Audio->SaveCueLog(FPaths::ProjectDir() / TEXT("Recordings/cues.json"));
		}
		RecordSeconds = 0.f;
		if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
		{
			PC->ConsoleCommand(TEXT("quit"));
		}
	}
	(void)RealDt;
}

// ============================================================================
//  Music
// ============================================================================

void AMoteGameMode::UpdateMusic()
{
	UMoteAudio* Audio = UMoteAudio::Get(this);
	if (!Audio)
	{
		return;
	}
	FName Want = CurrentMusic;
	switch (Phase)
	{
	case EMoteMatchPhase::Title:
	case EMoteMatchPhase::Select:
	case EMoteMatchPhase::Results:
		Want = TEXT("mus_menu");
		break;
	case EMoteMatchPhase::Intro:
	case EMoteMatchPhase::Countdown:
	case EMoteMatchPhase::Fight:
		Want = TEXT("mus_battle");
		break;
	case EMoteMatchPhase::GameSet:
		Want = NAME_None;
		break;
	}
	if (Want != CurrentMusic)
	{
		CurrentMusic = Want;
		Audio->PlayMusic(Want, Want.IsNone() ? 0.4f : 1.2f);
	}
}

// ============================================================================
//  Menus
// ============================================================================

void AMoteGameMode::MenuNavigate(int32 DX, int32 DY)
{
	UMoteAudio* Audio = UMoteAudio::Get(this);
	const int32 N = FMoteRoster::Num();
	bool bMoved = false;

	if (bPaused)
	{
		if (DY != 0)
		{
			Menu.PauseChoice = (Menu.PauseChoice + (DY > 0 ? 1 : 2)) % 3;
			bMoved = true;
		}
	}
	else if (Phase == EMoteMatchPhase::Select)
	{
		if (!Menu.bP1Locked)
		{
			// 4 x 2 grid.
			int32 Col = Menu.P1Cursor % 4;
			int32 Row = Menu.P1Cursor / 4;
			Col = (Col + DX + 4) % 4;
			Row = (Row + DY + 2) % 2;
			const int32 NewCursor = FMath::Clamp(Row * 4 + Col, 0, N - 1);
			bMoved = (NewCursor != Menu.P1Cursor);
			Menu.P1Cursor = NewCursor;
		}
		else
		{
			if (DX != 0)
			{
				// -1 (Random) .. N-1
				Menu.RivalCursor = ((Menu.RivalCursor + 1 + DX + (N + 1)) % (N + 1)) - 1;
				bMoved = true;
			}
			if (DY != 0)
			{
				Menu.Difficulty = FMath::Clamp(Menu.Difficulty - DY, 1, 9);
				bMoved = true;
			}
		}
		if (bMoved)
		{
			UpdateSelectPreview();
			if (CameraDirector && Fighters.Num() > 0)
			{
				CameraDirector->SetMode(EMoteCamMode::Select, Fighters[Menu.bP1Locked && Menu.RivalCursor >= 0 ? 1 : 0]);
			}
		}
	}
	else if (Phase == EMoteMatchPhase::Results)
	{
		if (DX != 0 || DY != 0)
		{
			Menu.ResultsChoice = 1 - Menu.ResultsChoice;
			bMoved = true;
		}
	}

	if (bMoved && Audio)
	{
		Audio->Play(TEXT("sfx_ui_move"), 0.6f);
	}
}

void AMoteGameMode::MenuConfirm()
{
	UMoteAudio* Audio = UMoteAudio::Get(this);
	if (Audio)
	{
		Audio->Play(TEXT("sfx_ui_select"), 0.8f);
	}

	if (bPaused)
	{
		const int32 Choice = Menu.PauseChoice;
		TogglePause();
		if (Choice == 1)
		{
			StartMatch(LastP1, LastP2, bLastP1CPU);
		}
		else if (Choice == 2)
		{
			EnterSelect();
		}
		return;
	}

	switch (Phase)
	{
	case EMoteMatchPhase::Title:
		if (Audio) { Audio->Play(TEXT("vo_mote_rumble"), 1.f); }
		EnterSelect();
		break;

	case EMoteMatchPhase::Select:
		if (!Menu.bP1Locked)
		{
			Menu.bP1Locked = true;
			if (Audio) { Audio->Play(*CoreSoundName(static_cast<EMoteCore>(Menu.P1Cursor)), 1.f); }
			UpdateSelectPreview();
		}
		else
		{
			const EMoteCore P1 = static_cast<EMoteCore>(Menu.P1Cursor);
			const EMoteCore P2 = Menu.RivalCursor >= 0 ? static_cast<EMoteCore>(Menu.RivalCursor) : FMoteRoster::RandomCore(P1);
			StartMatch(P1, P2, false);
		}
		break;

	case EMoteMatchPhase::Results:
		if (PhaseTime < 1.0f)
		{
			break;  // don't skip the winner call by accident
		}
		if (Menu.ResultsChoice == 0)
		{
			StartMatch(LastP1, LastP2, bLastP1CPU);
		}
		else
		{
			EnterSelect();
		}
		break;

	default:
		break;
	}
}

void AMoteGameMode::MenuBack()
{
	if (bPaused)
	{
		TogglePause();
		return;
	}
	if (Phase == EMoteMatchPhase::Select)
	{
		if (UMoteAudio* Audio = UMoteAudio::Get(this))
		{
			Audio->Play(TEXT("sfx_ui_back"), 0.7f);
		}
		if (Menu.bP1Locked)
		{
			Menu.bP1Locked = false;
			UpdateSelectPreview();
			if (CameraDirector && Fighters.Num() > 0)
			{
				CameraDirector->SetMode(EMoteCamMode::Select, Fighters[0]);
			}
		}
		else
		{
			EnterTitle();
		}
	}
}

void AMoteGameMode::TogglePause()
{
	if (Phase != EMoteMatchPhase::Fight && Phase != EMoteMatchPhase::Countdown && !bPaused)
	{
		return;
	}
	bPaused = !bPaused;
	Menu.PauseChoice = 0;
	UGameplayStatics::SetGamePaused(this, bPaused);
	if (UMoteAudio* Audio = UMoteAudio::Get(this))
	{
		Audio->Play(TEXT("sfx_pause"), 0.8f);
	}
}
