// Copyright Not Tim Games. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "MoteAudio.generated.h"

class USoundBase;
class UAudioComponent;

/**
 * Sound playback by name. Sounds live at /Game/Audio/<name> (imported from
 * SourceAudio/<name>.wav by Tools/import_content.py). A missing sound is
 * silently skipped, so the game runs before any audio has been imported.
 *
 * While recording (-MoteRecord) every cue is also logged with its match-clock
 * time so Tools/make_video.py can rebuild a frame-accurate soundtrack.
 */
UCLASS()
class MOTERUMBLE_API UMoteAudio : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	static UMoteAudio* Get(const UObject* WorldContext);

	/** Fire-and-forget 2D sound. PitchJitter randomises pitch by +/- that fraction. */
	void Play(FName Sound, float Volume = 1.f, float Pitch = 1.f, float PitchJitter = 0.f);
	/** Crossfade to a looping music track (NAME_None stops music). */
	void PlayMusic(FName Track, float FadeSeconds = 1.0f, float Volume = 0.55f);
	FName GetMusic() const { return MusicName; }

	/** Recording support. */
	void BeginCueLog();
	/** Called by the recorder once per captured frame with the capture clock. */
	void SetCueClock(double Seconds) { CueClock = Seconds; }
	bool SaveCueLog(const FString& Path) const;

protected:
	USoundBase* Find(FName Sound);

	UPROPERTY() TMap<FName, TObjectPtr<USoundBase>> Cache;
	UPROPERTY() TObjectPtr<UAudioComponent> Music;
	FName MusicName;
	TSet<FName> Missing;

	struct FCue { double Time; FName Name; float Volume; float Pitch; bool bMusic; };
	TArray<FCue> Cues;
	bool bLogging = false;
	double CueClock = 0.0;
};
