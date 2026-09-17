// Copyright Not Tim Games. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class MoteRumbleEditorTarget : TargetRules
{
	public MoteRumbleEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("MoteRumble");
	}
}
