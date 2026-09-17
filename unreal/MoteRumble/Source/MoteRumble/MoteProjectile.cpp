// Copyright Not Tim Games. All Rights Reserved.

#include "MoteProjectile.h"

#include "MoteCharacter.h"
#include "EngineUtils.h"
#include "Components/SphereComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/ProjectileMovementComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

AMoteProjectile::AMoteProjectile()
{
	PrimaryActorTick.bCanEverTick = true;
	InitialLifeSpan = 4.0f;

	Collision = CreateDefaultSubobject<USphereComponent>(TEXT("Collision"));
	Collision->InitSphereRadius(22.f);
	Collision->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Collision->SetCollisionResponseToAllChannels(ECR_Overlap);
	Collision->SetCollisionResponseToChannel(ECC_Camera, ECR_Ignore);
	Collision->SetGenerateOverlapEvents(true);
	RootComponent = Collision;

	Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(Collision);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetRelativeScale3D(FVector(0.35f));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (SphereMesh.Succeeded())
	{
		Mesh->SetStaticMesh(SphereMesh.Object);
	}

	static ConstructorHelpers::FObjectFinder<UMaterialInterface> BaseMat(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (BaseMat.Succeeded())
	{
		Mesh->SetMaterial(0, BaseMat.Object);
	}

	Movement = CreateDefaultSubobject<UProjectileMovementComponent>(TEXT("Movement"));
	Movement->SetUpdatedComponent(Collision);
	Movement->InitialSpeed = 1800.f;
	Movement->MaxSpeed = 3200.f;
	Movement->bRotationFollowsVelocity = false;
	Movement->bShouldBounce = false;
	Movement->ProjectileGravityScale = 0.f;
}

void AMoteProjectile::BeginPlay()
{
	Super::BeginPlay();
	Collision->OnComponentBeginOverlap.AddDynamic(this, &AMoteProjectile::OnOverlap);

	if (Mesh)
	{
		if (UMaterialInstanceDynamic* MID = Mesh->CreateAndSetMaterialInstanceDynamic(0))
		{
			MID->SetVectorParameterValue(TEXT("Color"), Color);
		}
	}
}

void AMoteProjectile::Launch(AMoteCharacter* InOwnerMote, const FMoteAttackDef& InAttack,
	const FLinearColor& InColor, const FVector& Direction)
{
	OwnerMote = InOwnerMote;
	Attack = InAttack;
	Color = InColor;
	SetInstigator(InOwnerMote);

	const FVector Dir = Direction.GetSafeNormal();

	if (Movement)
	{
		Movement->InitialSpeed = Attack.ProjectileSpeed;
		Movement->MaxSpeed = Attack.ProjectileSpeed * 1.6f;
		// Lobbed Cinders arc; everything else flies flat.
		const bool bLob = (Attack.Shape == EMoteAttackShape::Lob);
		Movement->ProjectileGravityScale = bLob ? 1.35f : 0.f;
		Movement->Velocity = Dir * Attack.ProjectileSpeed + (bLob ? FVector(0, 0, 620.f) : FVector::ZeroVector);
	}

	// Discs spin; bolts point where they fly.
	if (Attack.bReturns)
	{
		SpinRate = 900.f;
		Mesh->SetRelativeScale3D(FVector(0.55f, 0.55f, 0.12f));
	}
	else
	{
		SetActorRotation(Dir.Rotation());
		if (Attack.Shape == EMoteAttackShape::Lob)
		{
			Mesh->SetRelativeScale3D(FVector(0.4f));
		}
		else
		{
			Mesh->SetRelativeScale3D(FVector(0.45f, 0.2f, 0.2f));
		}
	}

	if (Attack.Shape == EMoteAttackShape::Lob)
	{
		// Cinders live until they land, not on a flight timer.
		InitialLifeSpan = 6.f;
	}
}

void AMoteProjectile::Reflect(AMoteCharacter* NewOwnerMote)
{
	OwnerMote = NewOwnerMote;
	SetInstigator(NewOwnerMote);
	HitActors.Reset();
	if (Movement)
	{
		Movement->Velocity = -Movement->Velocity * 1.25f;
	}
}

void AMoteProjectile::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Age += DeltaSeconds;

	if (SpinRate != 0.f)
	{
		AddActorLocalRotation(FRotator(0.f, SpinRate * DeltaSeconds, 0.f));
	}

	// Returning discs decelerate, turn around, and home back to the thrower.
	if (Attack.bReturns && Movement)
	{
		AMoteCharacter* Home = OwnerMote.Get();
		if (!bReturning)
		{
			Movement->Velocity -= Movement->Velocity.GetSafeNormal() * 2400.f * DeltaSeconds;
			if (Movement->Velocity.SizeSquared() < FMath::Square(260.f))
			{
				bReturning = true;
				HitActors.Reset();
			}
		}
		else if (Home)
		{
			const FVector ToHome = (Home->GetActorLocation() - GetActorLocation());
			Movement->Velocity += ToHome.GetSafeNormal() * 5200.f * DeltaSeconds;
			Movement->Velocity = Movement->Velocity.GetClampedToMaxSize(Attack.ProjectileSpeed * 1.2f);
			if (ToHome.SizeSquared() < FMath::Square(90.f) && Age > 0.35f)
			{
				Destroy();
			}
		}
	}

	// A lobbed Cinder detonates the moment it reaches the floor.
	if (Attack.Shape == EMoteAttackShape::Lob && GetActorLocation().Z <= 30.f)
	{
		Detonate();
	}
}

void AMoteProjectile::OnOverlap(UPrimitiveComponent* /*OverlappedComp*/, AActor* OtherActor,
	UPrimitiveComponent* /*OtherComp*/, int32 /*OtherBodyIndex*/,
	bool /*bFromSweep*/, const FHitResult& /*Sweep*/)
{
	AMoteCharacter* Target = Cast<AMoteCharacter>(OtherActor);
	if (!Target || Target == OwnerMote.Get())
	{
		return;
	}
	if (HitActors.Contains(Target))
	{
		return;
	}
	HitActors.Add(Target);

	if (Attack.Shape == EMoteAttackShape::Lob)
	{
		Detonate();
		return;
	}

	const FVector Dir = (Target->GetActorLocation() - GetActorLocation()).GetSafeNormal2D();
	Target->ReceiveHit(Attack.Damage, Dir, Attack.Knockback, OwnerMote.Get());

	if (!Attack.bPiercing && !Attack.bReturns)
	{
		Destroy();
	}
}

void AMoteProjectile::Detonate()
{
	const FVector Origin = GetActorLocation();
	const float Radius = (Attack.AoERadius > 0.f) ? Attack.AoERadius : 200.f;

	for (TActorIterator<AMoteCharacter> It(GetWorld()); It; ++It)
	{
		AMoteCharacter* Mote = *It;
		if (!Mote || Mote == OwnerMote.Get())
		{
			continue;
		}
		const FVector Delta = Mote->GetActorLocation() - Origin;
		if (Delta.SizeSquared2D() <= FMath::Square(Radius))
		{
			Mote->ReceiveHit(Attack.Damage, Delta.GetSafeNormal2D(), Attack.Knockback, OwnerMote.Get());
		}
	}

	Destroy();
}
