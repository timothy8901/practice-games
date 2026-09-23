// Copyright Not Tim Games. All Rights Reserved.

#include "MoteAudio.h"

#include "Components/AudioComponent.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Sound/SoundBase.h"
#include "Sound/SoundWave.h"

UMoteAudio* UMoteAudio::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UMoteAudio>() : nullptr;
}

USoundBase* UMoteAudio::Find(FName Sound)
{
	if (Sound.IsNone() || Missing.Contains(Sound))
	{
		return nullptr;
	}
	if (TObjectPtr<USoundBase>* Cached = Cache.Find(Sound))
	{
		return *Cached;
	}
	const FString Name = Sound.ToString();
	const FString Path = FString::Printf(TEXT("/Game/Audio/%s.%s"), *Name, *Name);
	USoundBase* Loaded = LoadObject<USoundBase>(nullptr, *Path, nullptr, LOAD_Quiet | LOAD_NoWarn);
	if (!Loaded)
	{
		Missing.Add(Sound);
		return nullptr;
	}
	Cache.Add(Sound, Loaded);
	return Loaded;
}

void UMoteAudio::Play(FName Sound, float Volume, float Pitch, float PitchJitter)
{
	const float FinalPitch = Pitch * (1.f + (PitchJitter > 0.f ? FMath::FRandRange(-PitchJitter, PitchJitter) : 0.f));
	if (bLogging && !Sound.IsNone())
	{
		Cues.Add({ CueClock, Sound, Volume, FinalPitch, false });
	}
	USoundBase* S = Find(Sound);
	if (!S)
	{
		return;
	}
	UGameplayStatics::PlaySound2D(this, S, Volume, FinalPitch);
}

void UMoteAudio::PlayMusic(FName Track, float FadeSeconds, float Volume)
{
	if (bLogging)
	{
		Cues.Add({ CueClock, Track.IsNone() ? FName(TEXT("music_stop")) : Track, Volume, 1.f, true });
	}
	if (Music)
	{
		Music->FadeOut(FadeSeconds, 0.f);
		Music = nullptr;
	}
	MusicName = Track;
	USoundBase* S = Find(Track);
	if (!S)
	{
		return;
	}
	if (USoundWave* Wave = Cast<USoundWave>(S))
	{
		Wave->bLooping = true;
	}
	Music = UGameplayStatics::CreateSound2D(this, S, Volume, 1.f, 0.f, nullptr, false, false);
	if (Music)
	{
		Music->bIsUISound = true;  // keeps playing through pause
		Music->FadeIn(FadeSeconds, Volume);
	}
}

void UMoteAudio::BeginCueLog()
{
	bLogging = true;
	Cues.Reset();
	CueClock = 0.0;
}

bool UMoteAudio::SaveCueLog(const FString& Path) const
{
	FString Json = TEXT("[\n");
	for (int32 i = 0; i < Cues.Num(); ++i)
	{
		const FCue& C = Cues[i];
		Json += FString::Printf(TEXT("  {\"t\": %.5f, \"name\": \"%s\", \"vol\": %.3f, \"pitch\": %.4f, \"music\": %s}%s\n"),
			C.Time, *C.Name.ToString(), C.Volume, C.Pitch, C.bMusic ? TEXT("true") : TEXT("false"),
			(i + 1 < Cues.Num()) ? TEXT(",") : TEXT(""));
	}
	Json += TEXT("]\n");
	return FFileHelper::SaveStringToFile(Json, *Path);
}
