// Copyright Not Tim Games. All Rights Reserved.
//
// The roster: eight Motes, six moves each. Numbers are tuned against the
// Smash-style knockback formula in AMoteCharacter::ComputeKnockback, so a
// light jab barely nudges at 0% and a charged heavy KOs from centre stage
// somewhere past 100%.

#include "MoteTypes.h"

namespace
{
	// ---- move builders: keep the table readable --------------------------------

	FMoteMoveDef Melee(const TCHAR* Name, EMoteMoveAnim Anim, EMoteHitShape Shape,
		float Startup, float Active, float Recovery,
		float Reach, float Radius, float Damage, float BKB, float KBG, float Angle,
		EMoteFxType Fx = EMoteFxType::Slash)
	{
		FMoteMoveDef M;
		M.Name = Name;
		M.Anim = Anim;
		M.Shape = Shape;
		M.Startup = Startup;
		M.Active = Active;
		M.Recovery = Recovery;
		M.Reach = Reach;
		M.Radius = Radius;
		M.Damage = Damage;
		M.BaseKnockback = BKB;
		M.KnockbackGrowth = KBG;
		M.LaunchAngle = Angle;
		M.Fx = Fx;
		M.SwingSound = (Damage >= 8.f) ? TEXT("sfx_swing_heavy") : TEXT("sfx_swing_light");
		return M;
	}

	FMoteMoveDef Shot(const TCHAR* Name, EMoteMoveAnim Anim, EMoteProjectileKind Kind,
		float Startup, float Recovery, float Speed, float Damage, float BKB, float KBG, float Angle,
		EMoteFxType Fx)
	{
		FMoteMoveDef M;
		M.Name = Name;
		M.Anim = Anim;
		M.Shape = EMoteHitShape::None;
		M.Startup = Startup;
		M.Active = 0.06f;
		M.Recovery = Recovery;
		M.Projectile = Kind;
		M.ProjectileSpeed = Speed;
		M.Damage = Damage;
		M.BaseKnockback = BKB;
		M.KnockbackGrowth = KBG;
		M.LaunchAngle = Angle;
		M.Fx = Fx;
		M.SwingSound = TEXT("sfx_projectile_fire");
		return M;
	}

	FMoteMoveDef& Charge(FMoteMoveDef& M, float MaxCharge, float Bonus)
	{
		M.bChargeable = true;
		M.MaxCharge = MaxCharge;
		M.ChargeBonus = Bonus;
		return M;
	}

	FMoteMoveDef Plunge(const TCHAR* Name, float Damage, float Fall, float LandingRadius, EMoteFxType Fx)
	{
		FMoteMoveDef M = Melee(Name, EMoteMoveAnim::Plunge, EMoteHitShape::Sphere,
			0.14f, 0.10f, 0.30f, 0.f, 105.f, Damage, 30.f, 75.f, -60.f, Fx);
		M.HeightOffset = -80.f;
		M.VerticalSpeed = -Fall;
		M.bPlungeUntilLanding = true;
		M.LandingRadius = LandingRadius;
		M.HitstopScale = 1.2f;
		M.ShakeScale = 1.4f;
		M.SwingSound = TEXT("sfx_dash");
		return M;
	}

	FString ArtPath(const TCHAR* Folder, const FString& AssetName)
	{
		return FString::Printf(TEXT("/Game/Art/%s/%s.%s"), Folder, *AssetName, *AssetName);
	}

	FMoteFighterDef MakeFighter(EMoteCore Core, const TCHAR* Key, const TCHAR* Name, const TCHAR* Epithet,
		const TCHAR* Blurb, FLinearColor Accent, FLinearColor Secondary)
	{
		FMoteFighterDef F;
		F.Core = Core;
		F.DisplayName = Name;
		F.Epithet = Epithet;
		F.Blurb = Blurb;
		F.Accent = Accent;
		F.Secondary = Secondary;
		F.BodyMesh = ArtPath(TEXT("Fighters"), FString::Printf(TEXT("SM_%s_Body"), Key));
		F.GauntletMesh = ArtPath(TEXT("Fighters"), FString::Printf(TEXT("SM_%s_Gauntlet"), Key));
		F.WeaponMesh = ArtPath(TEXT("Weapons"), FString::Printf(TEXT("SM_%s_Weapon"), Key));
		F.Moves.SetNum(static_cast<int32>(EMoteMoveSlot::Count));
		return F;
	}

	void Set(FMoteFighterDef& F, EMoteMoveSlot Slot, const FMoteMoveDef& Move)
	{
		F.EditMove(Slot) = Move;
	}

	TArray<FMoteFighterDef> BuildRoster()
	{
		using S = EMoteMoveSlot;
		using A = EMoteMoveAnim;
		using H = EMoteHitShape;
		using P = EMoteProjectileKind;
		using X = EMoteFxType;

		TArray<FMoteFighterDef> Roster;

		// =====================================================================
		// BLADE - all-rounder samurai. Fast combo, spinning charged cleave.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Blade, TEXT("Blade"), TEXT("BLADE"),
				TEXT("The Emerald Edge"),
				TEXT("A disciplined duelist. Quick cuts, a spinning cleave, and a falling-star plunge."),
				FLinearColor(0.35f, 0.95f, 0.45f), FLinearColor(0.85f, 0.68f, 0.25f));
			F.Weight = 96.f; F.RunSpeed = 860.f;
			F.Hold = EMoteWeaponHold::OneHandRight;
			F.Mount.Length = 190.f; F.Mount.GripFraction = -0.40f;

			Set(F, S::Jab1, Melee(TEXT("Edge Slash"), A::SlashRight, H::Arc, 0.08f, 0.06f, 0.20f, 210.f, 110.f, 3.f, 12.f, 30.f, 30.f));
			Set(F, S::Jab2, Melee(TEXT("Return Cut"), A::SlashLeft, H::Arc, 0.07f, 0.06f, 0.20f, 210.f, 110.f, 3.f, 12.f, 30.f, 30.f));
			FMoteMoveDef J3 = Melee(TEXT("Rising Thrust"), A::Thrust, H::Thrust, 0.10f, 0.08f, 0.34f, 260.f, 70.f, 6.f, 48.f, 88.f, 42.f, X::Pierce);
			J3.LungeSpeed = 700.f;
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Melee(TEXT("Crescent Cleave"), A::SpinSlash, H::Radial, 0.30f, 0.12f, 0.45f, 0.f, 250.f, 16.f, 40.f, 98.f, 38.f);
			Heavy.HitstopScale = 1.25f; Heavy.ShakeScale = 1.4f;
			Set(F, S::Heavy, Charge(Heavy, 1.0f, 1.45f));
			Set(F, S::AirLight, Melee(TEXT("Wheel Cut"), A::SpinSlash, H::Radial, 0.08f, 0.14f, 0.22f, 0.f, 195.f, 7.f, 25.f, 70.f, 45.f));
			Set(F, S::AirHeavy, Plunge(TEXT("Falling Star"), 12.f, 2600.f, 230.f, X::Slash));
			Roster.Add(F);
		}

		// =====================================================================
		// ARC - storm glaive. Long reach, calls lightning at range.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Arc, TEXT("Arc"), TEXT("ARC"),
				TEXT("The Stormcaller"),
				TEXT("Sweeping glaive arcs and lightning called down from the sky, far across the stage."),
				FLinearColor(1.0f, 0.84f, 0.30f), FLinearColor(0.20f, 0.22f, 0.28f));
			F.Weight = 90.f; F.RunSpeed = 880.f;
			F.Hold = EMoteWeaponHold::TwoHanded;
			F.Mount.Length = 250.f; F.Mount.GripFraction = -0.22f;

			Set(F, S::Jab1, Melee(TEXT("Glaive Sweep"), A::SlashRight, H::Arc, 0.09f, 0.07f, 0.22f, 255.f, 120.f, 3.f, 14.f, 30.f, 30.f, X::Electric));
			Set(F, S::Jab2, Melee(TEXT("Back Sweep"), A::SlashLeft, H::Arc, 0.08f, 0.07f, 0.22f, 255.f, 120.f, 3.f, 14.f, 30.f, 30.f, X::Electric));
			FMoteMoveDef J3 = Melee(TEXT("Storm Twirl"), A::Twirl, H::Sphere, 0.08f, 0.30f, 0.30f, 170.f, 150.f, 2.f, 50.f, 70.f, 62.f, X::Electric);
			J3.Hits = 4;
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Melee(TEXT("Thunderstrike"), A::Cast, H::None, 0.30f, 0.10f, 0.45f, 520.f, 170.f, 15.f, 40.f, 95.f, 80.f, X::Electric);
			Heavy.Projectile = P::Lightning;
			Heavy.ExplosionRadius = 175.f;
			Heavy.HitstopScale = 1.2f; Heavy.ShakeScale = 1.5f;
			Heavy.SwingSound = TEXT("sfx_charge_ready");
			Set(F, S::Heavy, Charge(Heavy, 1.0f, 1.4f));
			FMoteMoveDef Air = Melee(TEXT("Arc Twirl"), A::Twirl, H::Radial, 0.07f, 0.20f, 0.20f, 0.f, 190.f, 2.5f, 30.f, 70.f, 45.f, X::Electric);
			Air.Hits = 3;
			Set(F, S::AirLight, Air);
			Set(F, S::AirHeavy, Plunge(TEXT("Bolt Dive"), 11.f, 2800.f, 250.f, X::Electric));
			Roster.Add(F);
		}

		// =====================================================================
		// DISC - fast gladiator. Returning chakram, great mobility.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Disc, TEXT("Disc"), TEXT("DISC"),
				TEXT("The Golden Orbit"),
				TEXT("The quickest Mote. Slices up close, then hurls a chakram that comes right back."),
				FLinearColor(0.96f, 0.73f, 0.22f), FLinearColor(0.55f, 0.32f, 0.12f));
			F.Weight = 84.f; F.RunSpeed = 930.f; F.AirSpeed = 760.f;
			F.Hold = EMoteWeaponHold::OneHandRight;
			F.Mount.Length = 95.f; F.Mount.GripFraction = 0.f;

			Set(F, S::Jab1, Melee(TEXT("Disc Slice"), A::SlashRight, H::Arc, 0.06f, 0.05f, 0.18f, 185.f, 100.f, 2.5f, 10.f, 25.f, 25.f));
			Set(F, S::Jab2, Melee(TEXT("Disc Slice"), A::SlashLeft, H::Arc, 0.06f, 0.05f, 0.18f, 185.f, 100.f, 2.5f, 10.f, 25.f, 25.f));
			FMoteMoveDef J3 = Melee(TEXT("Rising Ring"), A::Uppercut, H::Sphere, 0.08f, 0.08f, 0.30f, 150.f, 120.f, 6.f, 50.f, 85.f, 75.f);
			J3.HeightOffset = 60.f;
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Shot(TEXT("Chakram Throw"), A::ThrowForward, P::Disc, 0.20f, 0.35f, 2200.f, 11.f, 30.f, 85.f, 38.f, X::Slash);
			Heavy.bProjectileReturns = true;
			Heavy.ProjectileLife = 1.5f;
			Heavy.SwingSound = TEXT("sfx_disc_throw");
			Set(F, S::Heavy, Charge(Heavy, 0.8f, 1.35f));
			Set(F, S::AirLight, Melee(TEXT("Halo Spin"), A::SpinSlash, H::Radial, 0.06f, 0.12f, 0.18f, 0.f, 175.f, 6.f, 20.f, 70.f, 40.f));
			FMoteMoveDef AirH = Shot(TEXT("Triple Ring"), A::ThrowForward, P::Disc, 0.12f, 0.30f, 2000.f, 5.f, 20.f, 60.f, 35.f, X::Slash);
			AirH.ProjectileCount = 3; AirH.ProjectileSpread = 40.f; AirH.ProjectilePitch = -15.f; AirH.ProjectileLife = 0.9f;
			AirH.SwingSound = TEXT("sfx_disc_throw");
			Set(F, S::AirHeavy, AirH);
			Roster.Add(F);
		}

		// =====================================================================
		// MAUL - heavyweight. Slow, enormous knockback, quakes the floor.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Maul, TEXT("Maul"), TEXT("MAUL"),
				TEXT("The Iron Quake"),
				TEXT("A walking siege engine. Every swing is slow, and every swing can end a stock."),
				FLinearColor(0.85f, 0.35f, 0.22f), FLinearColor(0.30f, 0.26f, 0.24f));
			F.Weight = 125.f; F.RunSpeed = 720.f; F.AirSpeed = 600.f; F.JumpVelocity = 980.f; F.AirJumps = 1;
			F.GravityScale = 2.7f;
			F.Hold = EMoteWeaponHold::TwoHanded;
			F.Mount.Length = 210.f; F.Mount.GripFraction = -0.30f;

			Set(F, S::Jab1, Melee(TEXT("Haft Swing"), A::SlashRight, H::Arc, 0.13f, 0.08f, 0.28f, 225.f, 130.f, 6.f, 20.f, 40.f, 30.f, X::Blunt));
			Set(F, S::Jab2, Melee(TEXT("Backswing"), A::SlashLeft, H::Arc, 0.12f, 0.08f, 0.30f, 225.f, 130.f, 6.f, 22.f, 40.f, 30.f, X::Blunt));
			FMoteMoveDef J3 = Melee(TEXT("Crusher"), A::Overhead, H::Sphere, 0.18f, 0.08f, 0.45f, 195.f, 140.f, 12.f, 50.f, 90.f, 45.f, X::Blunt);
			J3.HitstopScale = 1.3f; J3.ShakeScale = 1.6f;
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Melee(TEXT("Earthshaker"), A::GroundSlam, H::Radial, 0.45f, 0.10f, 0.55f, 0.f, 360.f, 21.f, 45.f, 100.f, 55.f, X::Blunt);
			Heavy.HitstopScale = 1.4f; Heavy.ShakeScale = 2.4f;
			Heavy.SwingSound = TEXT("sfx_slam");
			Set(F, S::Heavy, Charge(Heavy, 1.2f, 1.5f));
			Set(F, S::AirLight, Melee(TEXT("Hammer Flip"), A::SpinSlash, H::Radial, 0.12f, 0.12f, 0.30f, 0.f, 205.f, 10.f, 30.f, 80.f, 40.f, X::Blunt));
			FMoteMoveDef AirH = Plunge(TEXT("Meteor Maul"), 16.f, 3000.f, 330.f, X::Blunt);
			AirH.ShakeScale = 2.2f;
			Set(F, S::AirHeavy, AirH);
			Roster.Add(F);
		}

		// =====================================================================
		// BOW - zoner. Keeps you out with arrows; charged shot pierces.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Bow, TEXT("Bow"), TEXT("BOW"),
				TEXT("The Verdant Eye"),
				TEXT("A patient ranger. Peppers you from range, and a full-draw shot flies clean through."),
				FLinearColor(0.42f, 0.78f, 0.35f), FLinearColor(0.45f, 0.30f, 0.18f));
			F.Weight = 80.f; F.RunSpeed = 860.f; F.AirJumps = 2; F.HoverTime = 1.4f;
			F.Hold = EMoteWeaponHold::BowLeft;
			F.ProjectileMesh = ArtPath(TEXT("Weapons"), TEXT("SM_Bow_Arrow"));
			F.Mount.Length = 170.f; F.Mount.GripFraction = 0.f;

			Set(F, S::Jab1, Melee(TEXT("Bow Swipe"), A::BowBash, H::Arc, 0.07f, 0.06f, 0.20f, 175.f, 100.f, 3.f, 12.f, 25.f, 30.f, X::Blunt));
			Set(F, S::Jab2, Melee(TEXT("Limb Strike"), A::SlashLeft, H::Arc, 0.07f, 0.06f, 0.20f, 175.f, 100.f, 3.f, 12.f, 25.f, 30.f, X::Blunt));
			FMoteMoveDef J3 = Shot(TEXT("Point Blank"), A::DrawBow, P::Arrow, 0.12f, 0.30f, 2600.f, 7.f, 40.f, 80.f, 35.f, X::Pierce);
			J3.ProjectileLife = 0.6f;
			J3.SwingSound = TEXT("sfx_arrow_fire");
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Shot(TEXT("Heartseeker"), A::DrawBow, P::Arrow, 0.18f, 0.35f, 3200.f, 12.f, 30.f, 85.f, 30.f, X::Pierce);
			Heavy.bProjectilePierces = true;
			Heavy.ProjectileLife = 1.0f;
			Heavy.SwingSound = TEXT("sfx_arrow_fire");
			Set(F, S::Heavy, Charge(Heavy, 1.2f, 1.6f));
			FMoteMoveDef AirL = Shot(TEXT("Sky Shot"), A::DrawBow, P::Arrow, 0.10f, 0.25f, 2800.f, 6.f, 20.f, 60.f, 35.f, X::Pierce);
			AirL.ProjectilePitch = -25.f; AirL.ProjectileLife = 0.8f;
			AirL.SwingSound = TEXT("sfx_arrow_fire");
			Set(F, S::AirLight, AirL);
			FMoteMoveDef AirH = Shot(TEXT("Arrow Rain"), A::DrawBow, P::Arrow, 0.16f, 0.35f, 2600.f, 5.f, 20.f, 65.f, 40.f, X::Pierce);
			AirH.ProjectileCount = 3; AirH.ProjectileSpread = 30.f; AirH.ProjectilePitch = -30.f; AirH.ProjectileLife = 0.8f;
			AirH.SwingSound = TEXT("sfx_arrow_fire");
			Set(F, S::AirHeavy, AirH);
			Roster.Add(F);
		}

		// =====================================================================
		// FLARE - rushdown brawler. Blazing fists and a burning dash.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Flare, TEXT("Flare"), TEXT("FLARE"),
				TEXT("The Wildfire"),
				TEXT("Pure aggression. Lightning-fast fists, a phoenix uppercut, and a charging blaze."),
				FLinearColor(1.0f, 0.38f, 0.14f), FLinearColor(0.12f, 0.10f, 0.10f));
			F.Weight = 100.f; F.RunSpeed = 960.f; F.AirSpeed = 740.f;
			F.Hold = EMoteWeaponHold::Gauntlets;
			F.WeaponMesh.Reset();
			F.GauntletSize = 52.f;

			Set(F, S::Jab1, Melee(TEXT("Ember Jab"), A::PunchRight, H::Sphere, 0.05f, 0.05f, 0.16f, 145.f, 90.f, 2.5f, 10.f, 20.f, 22.f, X::Fire));
			Set(F, S::Jab2, Melee(TEXT("Ember Cross"), A::PunchLeft, H::Sphere, 0.05f, 0.05f, 0.16f, 145.f, 90.f, 2.5f, 10.f, 20.f, 22.f, X::Fire));
			FMoteMoveDef J3 = Melee(TEXT("Phoenix Rise"), A::FlameUppercut, H::Sphere, 0.08f, 0.10f, 0.32f, 130.f, 120.f, 7.f, 50.f, 85.f, 80.f, X::Fire);
			J3.HeightOffset = 60.f; J3.VerticalSpeed = 900.f;
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Melee(TEXT("Blaze Rush"), A::DashStrike, H::Thrust, 0.22f, 0.25f, 0.40f, 150.f, 110.f, 15.f, 40.f, 95.f, 35.f, X::Fire);
			Heavy.LungeSpeed = 2400.f;
			Heavy.HitstopScale = 1.2f; Heavy.ShakeScale = 1.4f;
			Heavy.SwingSound = TEXT("sfx_fire_whoosh");
			Set(F, S::Heavy, Charge(Heavy, 1.0f, 1.4f));
			FMoteMoveDef AirL = Melee(TEXT("Fire Wheel"), A::SpinSlash, H::Radial, 0.06f, 0.15f, 0.20f, 0.f, 175.f, 3.f, 25.f, 70.f, 45.f, X::Fire);
			AirL.Hits = 3;
			Set(F, S::AirLight, AirL);
			FMoteMoveDef AirH = Shot(TEXT("Flame Burst"), A::ThrowForward, P::Fireball, 0.12f, 0.32f, 1700.f, 10.f, 30.f, 75.f, 45.f, X::Fire);
			AirH.ProjectilePitch = -35.f; AirH.ProjectileLife = 0.6f; AirH.ExplosionRadius = 185.f;
			AirH.SwingSound = TEXT("sfx_fire_whoosh");
			Set(F, S::AirHeavy, AirH);
			Roster.Add(F);
		}

		// =====================================================================
		// CINDER - trapper. Bombs everywhere.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Cinder, TEXT("Cinder"), TEXT("CINDER"),
				TEXT("The Short Fuse"),
				TEXT("Controls the stage with lobbed bombs. Stand still near Cinder at your peril."),
				FLinearColor(1.0f, 0.55f, 0.18f), FLinearColor(0.25f, 0.20f, 0.17f));
			F.Weight = 106.f; F.RunSpeed = 790.f;
			F.Hold = EMoteWeaponHold::BombRight;
			F.ProjectileMesh = F.WeaponMesh;
			F.Mount.Length = 62.f; F.Mount.GripFraction = 0.f;

			Set(F, S::Jab1, Melee(TEXT("Bomb Bonk"), A::PunchRight, H::Sphere, 0.08f, 0.06f, 0.20f, 140.f, 95.f, 3.f, 12.f, 25.f, 30.f, X::Blunt));
			Set(F, S::Jab2, Melee(TEXT("Bomb Bonk"), A::PunchLeft, H::Sphere, 0.08f, 0.06f, 0.20f, 140.f, 95.f, 3.f, 12.f, 25.f, 30.f, X::Blunt));
			FMoteMoveDef J3 = Melee(TEXT("Short Fuse"), A::Thrust, H::Sphere, 0.14f, 0.06f, 0.34f, 170.f, 150.f, 8.f, 55.f, 80.f, 45.f, X::Explosion);
			J3.ShakeScale = 1.4f;
			J3.SwingSound = TEXT("sfx_explosion");
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Shot(TEXT("Big Bomb"), A::Lob, P::Bomb, 0.20f, 0.35f, 1350.f, 16.f, 40.f, 95.f, 55.f, X::Explosion);
			Heavy.ProjectilePitch = 45.f; Heavy.ProjectileLife = 2.2f; Heavy.ExplosionRadius = 285.f;
			Heavy.ShakeScale = 1.8f;
			Heavy.SwingSound = TEXT("sfx_swing_heavy");
			Set(F, S::Heavy, Charge(Heavy, 1.0f, 1.3f));
			FMoteMoveDef AirL = Shot(TEXT("Drop Bomb"), A::Lob, P::Bomb, 0.08f, 0.25f, 600.f, 9.f, 30.f, 70.f, 60.f, X::Explosion);
			AirL.ProjectilePitch = -80.f; AirL.ProjectileLife = 1.6f; AirL.ExplosionRadius = 200.f;
			AirL.SwingSound = TEXT("sfx_swing_light");
			Set(F, S::AirLight, AirL);
			FMoteMoveDef AirH = Shot(TEXT("Cluster Toss"), A::ThrowForward, P::Bomb, 0.14f, 0.34f, 1100.f, 7.f, 25.f, 70.f, 50.f, X::Explosion);
			AirH.ProjectileCount = 3; AirH.ProjectileSpread = 45.f; AirH.ProjectilePitch = 20.f;
			AirH.ProjectileLife = 1.6f; AirH.ExplosionRadius = 180.f;
			AirH.SwingSound = TEXT("sfx_swing_heavy");
			Set(F, S::AirHeavy, AirH);
			Roster.Add(F);
		}

		// =====================================================================
		// VEIL - technical duelist. Rapid pokes, reflecting spins, a drill dash.
		// =====================================================================
		{
			FMoteFighterDef F = MakeFighter(EMoteCore::Veil, TEXT("Veil"), TEXT("VEIL"),
				TEXT("The Rose Parasol"),
				TEXT("Elegant and slippery. Spins that turn projectiles around, and a drilling lunge."),
				FLinearColor(0.93f, 0.35f, 0.62f), FLinearColor(0.95f, 0.92f, 0.88f));
			F.Weight = 88.f; F.RunSpeed = 880.f; F.HoverTime = 1.6f; F.GravityScale = 2.2f;
			F.Hold = EMoteWeaponHold::OneHandRight;
			F.Mount.Length = 175.f; F.Mount.GripFraction = -0.42f;

			Set(F, S::Jab1, Melee(TEXT("Point Jab"), A::Thrust, H::Thrust, 0.06f, 0.05f, 0.18f, 215.f, 60.f, 3.f, 10.f, 25.f, 25.f, X::Pierce));
			Set(F, S::Jab2, Melee(TEXT("Point Jab"), A::Thrust, H::Thrust, 0.06f, 0.05f, 0.18f, 215.f, 60.f, 3.f, 10.f, 25.f, 25.f, X::Pierce));
			FMoteMoveDef J3 = Melee(TEXT("Bloom"), A::ParasolSpin, H::Radial, 0.08f, 0.26f, 0.30f, 0.f, 190.f, 2.5f, 45.f, 80.f, 55.f);
			J3.Hits = 3; J3.bReflects = true;
			J3.SwingSound = TEXT("sfx_spin");
			Set(F, S::Jab3, J3);
			FMoteMoveDef Heavy = Melee(TEXT("Petal Drill"), A::Drill, H::Thrust, 0.24f, 0.30f, 0.40f, 230.f, 90.f, 3.f, 45.f, 95.f, 40.f, X::Pierce);
			Heavy.Hits = 5; Heavy.LungeSpeed = 1500.f;
			Heavy.SwingSound = TEXT("sfx_spin");
			Set(F, S::Heavy, Charge(Heavy, 1.0f, 1.35f));
			FMoteMoveDef AirL = Melee(TEXT("Twirl Guard"), A::ParasolSpin, H::Radial, 0.06f, 0.20f, 0.20f, 0.f, 180.f, 3.f, 20.f, 60.f, 45.f);
			AirL.Hits = 2; AirL.bReflects = true;
			AirL.SwingSound = TEXT("sfx_spin");
			Set(F, S::AirLight, AirL);
			Set(F, S::AirHeavy, Plunge(TEXT("Parasol Plunge"), 11.f, 2500.f, 220.f, X::Pierce));
			Roster.Add(F);
		}

		return Roster;
	}
}

const TArray<FMoteFighterDef>& FMoteRoster::All()
{
	static const TArray<FMoteFighterDef> Roster = BuildRoster();
	return Roster;
}

const FMoteFighterDef& FMoteRoster::Get(EMoteCore Core)
{
	const TArray<FMoteFighterDef>& Roster = All();
	const int32 Index = FMath::Clamp(static_cast<int32>(Core), 0, Roster.Num() - 1);
	return Roster[Index];
}

EMoteCore FMoteRoster::RandomCore(EMoteCore Exclude)
{
	const int32 Count = Num();
	if (Exclude == EMoteCore::Count || Count <= 1)
	{
		return static_cast<EMoteCore>(FMath::RandRange(0, Count - 1));
	}
	// Draw from the other N-1, then skip over the excluded slot.
	int32 Pick = FMath::RandRange(0, Count - 2);
	if (Pick >= static_cast<int32>(Exclude))
	{
		++Pick;
	}
	return static_cast<EMoteCore>(Pick);
}

EMoteCore FMoteRoster::FromName(const FString& Name, EMoteCore Fallback)
{
	for (const FMoteFighterDef& F : All())
	{
		if (F.DisplayName.Equals(Name, ESearchCase::IgnoreCase))
		{
			return F.Core;
		}
	}
	return Fallback;
}
