// Copyright Not Tim Games. All Rights Reserved.
//
// The eight Cores, tuned. Kept as plain C++ data so the whole game is
// playable without authoring a single binary asset; a DataTable can override
// this later without touching gameplay code.

#include "MoteTypes.h"

namespace
{
	FMoteAttackDef MakeMelee(const TCHAR* Name, EMoteAttackShape Shape, float Damage, float Range,
		float Arc, float Knockback, float Cooldown, float WindUp, float Duration)
	{
		FMoteAttackDef A;
		A.DisplayName = FName(Name);
		A.Shape = Shape;
		A.Damage = Damage;
		A.Range = Range;
		A.ArcDegrees = Arc;
		A.Knockback = Knockback;
		A.Cooldown = Cooldown;
		A.WindUp = WindUp;
		A.Duration = Duration;
		return A;
	}

	FMoteAttackDef MakeShot(const TCHAR* Name, EMoteAttackShape Shape, float Damage, float Speed,
		float Knockback, float Cooldown, float WindUp, float Duration)
	{
		FMoteAttackDef A;
		A.DisplayName = FName(Name);
		A.Shape = Shape;
		A.Damage = Damage;
		A.ProjectileSpeed = Speed;
		A.Knockback = Knockback;
		A.Cooldown = Cooldown;
		A.WindUp = WindUp;
		A.Duration = Duration;
		return A;
	}

	const TArray<FMoteCoreDef>& BuildTable()
	{
		static TArray<FMoteCoreDef> Table;
		if (Table.Num() > 0)
		{
			return Table;
		}
		Table.Reserve(8);

		auto Add = [](EMoteCore Core, const TCHAR* Name, FLinearColor Color,
			const FMoteAttackDef& Primary, const FMoteAttackDef& Special)
		{
			FMoteCoreDef Def;
			Def.Core = Core;
			Def.DisplayName = FName(Name);
			Def.Color = Color;
			Def.Primary = Primary;
			Def.Special = Special;
			Table.Add(Def);
		};

		// ---- Blade: clean, fast, honest melee. -------------------------------
		{
			FMoteAttackDef Spin = MakeMelee(TEXT("Spin Cleave"), EMoteAttackShape::Spin,
				2.f, 300.f, 360.f, 900.f, 1.7f, 0.22f, 0.60f);
			Add(EMoteCore::Blade, TEXT("Blade"), FLinearColor(0.35f, 0.95f, 0.45f),
				MakeMelee(TEXT("Slash"), EMoteAttackShape::MeleeArc,
					1.f, 280.f, 115.f, 650.f, 0.45f, 0.14f, 0.34f),
				Spin);
		}

		// ---- Arc: long whip, then a ranged bolt. ------------------------------
		{
			FMoteAttackDef Bolt = MakeShot(TEXT("Arc Bolt"), EMoteAttackShape::Projectile,
				2.f, 1700.f, 650.f, 1.8f, 0.18f, 0.40f);
			Add(EMoteCore::Arc, TEXT("Arc"), FLinearColor(1.0f, 0.84f, 0.30f),
				MakeMelee(TEXT("Chain Whip"), EMoteAttackShape::MeleeArc,
					1.f, 340.f, 130.f, 450.f, 0.50f, 0.15f, 0.36f),
				Bolt);
		}

		// ---- Disc: returning thrown blade, then a fan of three. ---------------
		{
			FMoteAttackDef Throw = MakeShot(TEXT("Disc Throw"), EMoteAttackShape::Projectile,
				1.f, 1500.f, 400.f, 0.80f, 0.14f, 0.34f);
			Throw.bReturns = true;

			FMoteAttackDef Triple = MakeShot(TEXT("Triple Disc"), EMoteAttackShape::Projectile,
				1.f, 1500.f, 400.f, 1.9f, 0.16f, 0.42f);
			Triple.bReturns = true;
			Triple.ProjectileCount = 3;
			Triple.SpreadDegrees = 48.f;

			Add(EMoteCore::Disc, TEXT("Disc"), FLinearColor(0.96f, 0.73f, 0.22f), Throw, Triple);
		}

		// ---- Maul: slow, heavy, huge knockback. -------------------------------
		{
			FMoteAttackDef Slam = MakeMelee(TEXT("Ground Slam"), EMoteAttackShape::Slam,
				2.f, 430.f, 360.f, 1200.f, 2.3f, 0.32f, 0.78f);
			Add(EMoteCore::Maul, TEXT("Maul"), FLinearColor(0.85f, 0.35f, 0.22f),
				MakeMelee(TEXT("Heavy Swing"), EMoteAttackShape::MeleeArc,
					2.f, 300.f, 95.f, 900.f, 0.85f, 0.24f, 0.52f),
				Slam);
		}

		// ---- Bow: fast plink, then a piercing power shot. ---------------------
		{
			FMoteAttackDef Power = MakeShot(TEXT("Piercing Shot"), EMoteAttackShape::Projectile,
				2.f, 2900.f, 700.f, 1.7f, 0.22f, 0.44f);
			Power.bPiercing = true;

			Add(EMoteCore::Bow, TEXT("Bow"), FLinearColor(0.42f, 0.78f, 0.35f),
				MakeShot(TEXT("Quick Bolt"), EMoteAttackShape::Projectile,
					1.f, 2300.f, 300.f, 0.40f, 0.10f, 0.26f),
				Power);
		}

		// ---- Flare: close cone, then a committed lunge. -----------------------
		{
			FMoteAttackDef DashAtk = MakeMelee(TEXT("Flare Dash"), EMoteAttackShape::Dash,
				2.f, 190.f, 360.f, 800.f, 2.1f, 0.06f, 0.38f);
			DashAtk.DashDistance = 760.f;

			Add(EMoteCore::Flare, TEXT("Flare"), FLinearColor(1.0f, 0.38f, 0.14f),
				MakeMelee(TEXT("Flame Cone"), EMoteAttackShape::MeleeArc,
					1.f, 360.f, 80.f, 320.f, 0.50f, 0.12f, 0.42f),
				DashAtk);
		}

		// ---- Cinder: lobbed explosives, area denial. --------------------------
		{
			FMoteAttackDef Toss = MakeShot(TEXT("Cinder Toss"), EMoteAttackShape::Lob,
				1.f, 1150.f, 700.f, 0.95f, 0.16f, 0.38f);
			Toss.AoERadius = 220.f;

			FMoteAttackDef Mega = MakeShot(TEXT("Mega Cinder"), EMoteAttackShape::Lob,
				2.f, 1000.f, 1000.f, 2.3f, 0.20f, 0.46f);
			Mega.AoERadius = 330.f;

			Add(EMoteCore::Cinder, TEXT("Cinder"), FLinearColor(0.55f, 0.45f, 0.35f), Toss, Mega);
		}

		// ---- Veil: short jab, then a reflecting twirl. ------------------------
		{
			FMoteAttackDef Twirl = MakeMelee(TEXT("Veil Spin"), EMoteAttackShape::Spin,
				1.f, 280.f, 360.f, 800.f, 1.5f, 0.12f, 0.70f);
			Twirl.bReflects = true;

			Add(EMoteCore::Veil, TEXT("Veil"), FLinearColor(0.93f, 0.35f, 0.62f),
				MakeMelee(TEXT("Veil Jab"), EMoteAttackShape::MeleeArc,
					1.f, 250.f, 70.f, 480.f, 0.40f, 0.10f, 0.28f),
				Twirl);
		}

		return Table;
	}
}

const TArray<FMoteCoreDef>& FMoteCoreLibrary::All()
{
	return BuildTable();
}

const FMoteCoreDef& FMoteCoreLibrary::Get(EMoteCore Core)
{
	const TArray<FMoteCoreDef>& Table = BuildTable();
	const int32 Index = static_cast<int32>(Core);
	if (Table.IsValidIndex(Index))
	{
		return Table[Index];
	}
	return Table[0];
}

const FMoteAttackDef& FMoteCoreLibrary::GetAttack(EMoteCore Core, EMoteAttackSlot Slot)
{
	const FMoteCoreDef& Def = Get(Core);
	return (Slot == EMoteAttackSlot::Special) ? Def.Special : Def.Primary;
}

EMoteCore FMoteCoreLibrary::RandomCore(EMoteCore Exclude)
{
	const int32 Num = static_cast<int32>(EMoteCore::Count);
	if (Exclude == EMoteCore::Count)
	{
		return static_cast<EMoteCore>(FMath::RandRange(0, Num - 1));
	}

	// Pick from the remaining Num-1 and skip over the excluded slot.
	int32 Pick = FMath::RandRange(0, Num - 2);
	if (Pick >= static_cast<int32>(Exclude))
	{
		++Pick;
	}
	return static_cast<EMoteCore>(Pick);
}
