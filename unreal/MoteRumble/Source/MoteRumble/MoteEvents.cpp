// Copyright Not Tim Games. All Rights Reserved.

#include "MoteEvents.h"

#include "Engine/World.h"

UMoteEventHub* UMoteEventHub::Get(const UObject* WorldContext)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;
	return World ? World->GetSubsystem<UMoteEventHub>() : nullptr;
}

void UMoteEventHub::Announce(const FString& Text, const FLinearColor& Color, float Duration, int32 Size)
{
	FMoteAnnouncement A;
	A.Text = Text;
	A.Color = Color;
	A.Duration = Duration;
	A.Size = Size;
	OnAnnounce.Broadcast(A);
}

void UMoteEventHub::Flash(const FLinearColor& Color, float Duration)
{
	OnScreenFlash.Broadcast(Color, Duration);
}
