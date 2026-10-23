using System;
using System.Linq;
using System.Xml;
using System.IO;
using CodeWalker.GameFiles;
using CodeWalkerCLI;

internal static class UvClipHashTests
{
    private static int checks;

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
        checks++;
    }

    private static uint Hash(string name) => JenkHash.GenHash(name.ToLowerInvariant());

    private static string Normalize(string xml)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml);
        return doc.OuterXml;
    }

    private static string Fixture(uint clipHash, bool uv = true)
    {
        return $@"<ClipDictionary><Clips><Item>
<Hash>hash_{clipHash:X8}</Hash><Name>pack:/shared.clip</Name>
<Type value=""Animation""/><AnimationHash>shared_animation</AnimationHash>
<StartTime value=""0""/><EndTime value=""1""/><Rate value=""1""/>
</Item></Clips><Animations><Item><Hash>shared_animation</Hash>
<Unknown10 value=""1""/><FrameCount value=""2""/><SequenceFrameLimit value=""31""/>
<Duration value=""1""/><Unknown1C>hash_00000000</Unknown1C>
<BoneIds><Item><BoneId value=""0""/><Track value=""{(uv ? 17 : 0)}""/><Unk0 value=""0""/></Item></BoneIds>
<Sequences><Item><Hash>hash_00000000</Hash><FrameCount value=""2""/>
<SequenceData><Item><Channels>
<Item><Type value=""StaticFloat""/><Value value=""1""/></Item>
<Item><Type value=""StaticFloat""/><Value value=""0""/></Item>
<Item><Type value=""StaticFloat""/><Value value=""0""/></Item>
</Channels></Item></SequenceData></Item></Sequences>
</Item></Animations></ClipDictionary>";
    }

    private static uint ClipHash(string xml)
    {
        var doc = new XmlDocument();
        doc.LoadXml(xml);
        return Convert.ToUInt32(doc.SelectSingleNode("/ClipDictionary/Clips/Item/Hash").InnerText.Substring(5), 16);
    }

    private static void Main()
    {
        foreach (string newName in new[] { "new_panel", "prefix_old_panel", "old_panel_suffix" })
        {
            var renamer = new UvClipHashRenamer(Hash);
            renamer.AddModel("old_panel", newName, 6);
            foreach (int index in new[] { 0, 3, 5 })
            {
                uint oldClip = unchecked(Hash("old_panel") + (uint)index + 1);
                uint expected = unchecked(Hash(newName) + (uint)index + 1);
                string xml = Fixture(oldClip);
                int count;
                string result = renamer.Rename(xml, out count);
                Assert(count == 1 && ClipHash(result) == expected, "UV material index must survive renaming");
                Assert(Normalize(result.Replace($"hash_{expected:X8}", $"hash_{oldClip:X8}")) == Normalize(xml),
                    "Animation data, timing and shared animation references must remain unchanged");
                Assert(renamer.Rename(result, out count) == result && count == 0, "Must not rename twice");
                string skeletal = Fixture(oldClip, false);
                Assert(renamer.Rename(skeletal, out count) == skeletal && count == 0, "Skeletal clips must not change");
            }
            int ignored;
            string outside = Fixture(unchecked(Hash("old_panel") + 7));
            Assert(renamer.Rename(outside, out ignored) == outside, "Out-of-range material must not match");
        }

        var wrap = new UvClipHashRenamer(s => s == "old" ? uint.MaxValue : 10);
        wrap.AddModel("old", "new", 2);
        int changes;
        Assert(ClipHash(wrap.Rename(Fixture(0), out changes)) == 11, "Hash arithmetic must wrap at uint32");

        var collision = new UvClipHashRenamer(s => s.StartsWith("old") ? 10u : s == "new_a" ? 20u : 30u);
        collision.AddModel("old_a", "new_a", 1);
        collision.AddModel("old_b", "new_b", 1);
        string ambiguous = Fixture(11);
        Assert(collision.Rename(ambiguous, out changes) == ambiguous, "Ambiguous model hashes must be left alone");

        foreach (string mode in new[] { "replace", "prefix", "suffix" })
            TestPipeline(mode);

        Console.WriteLine($"PASS: {checks} regression checks");
    }

    private static void TestPipeline(string mode)
    {
        string directory = Path.Combine(Path.GetTempPath(), "5m-uv-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            byte[] pixels = { 1, 2, 3, 4, 5, 6, 7, 8 };
            var textures = new TextureDictionary();
            textures.BuildFromTextureList(new System.Collections.Generic.List<Texture>
            {
                new Texture
                {
                    Name = "shared_texture", Width = 4, Height = 4, Depth = 1,
                    Levels = 1, Stride = 2, Format = TextureFormat.D3DFMT_DXT1,
                    Data = new TextureData { FullData = pixels }
                }
            });
            var model = new YdrFile
            {
                Drawable = new Drawable
                {
                    Name = "old_panel",
                    LightAttributes = new ResourceSimpleList64<LightAttributes>(),
                    ShaderGroup = new ShaderGroup
                    {
                        TextureDictionary = textures,
                        Shaders = new ResourcePointerArray64<ShaderFX>
                        {
                            data_items = Enumerable.Range(0, 4).Select(_ => new ShaderFX()).ToArray()
                        }
                    }
                }
            };
            File.WriteAllBytes(Path.Combine(directory, "old_panel.ydr"), model.Save());
            string clip = Fixture(unchecked(Hash("old_panel") + 4))
                .Replace("shared_animation", "old_animation").Replace("shared.clip", "old_clip.clip");
            File.WriteAllBytes(Path.Combine(directory, "shared.ycd"), XmlYcd.GetYcd(clip).Save());
            var options = new RenameOptions { InputPath = directory, FindText = "old_" };
            string newName;
            if (mode == "replace") { options.ReplaceText = "new_"; newName = "new_panel"; }
            else if (mode == "prefix") { options.PrefixText = "pre_"; newName = "pre_old_panel"; }
            else { options.SuffixText = "_post"; newName = "old__postpanel"; }

            var result = new AssetsRenamer(options).Execute();
            Assert(result.Success && result.Errors == 0, mode + ": pipeline errors");
            Assert(File.Exists(Path.Combine(directory, newName + ".ydr")), mode + ": renamed model missing");
            var renamedModel = new YdrFile();
            renamedModel.Load(File.ReadAllBytes(Path.Combine(directory, newName + ".ydr")));
            Assert(renamedModel.Drawable.Name == newName, mode + ": internal drawable name must match renamed model");
            Assert(renamedModel.Drawable.ShaderGroup.Shaders.data_items.Length == 4,
                mode + ": shader table must survive drawable rename");
            var texture = renamedModel.Drawable.ShaderGroup.TextureDictionary.Textures.data_items.Single();
            Assert(texture.Name == "shared_texture" && texture.Data.FullData.SequenceEqual(pixels),
                mode + ": embedded texture name and pixels must survive drawable rename");
            var output = new YcdFile();
            RpfFile.LoadResourceFile(output, File.ReadAllBytes(Path.Combine(directory, "shared.ycd")), 46);
            output.InitDictionaries();
            string outputXml = YcdXml.GetXml(output);
            Assert(ClipHash(outputXml) == unchecked(Hash(newName) + 4), mode + ": binary YCD clip hash incorrect");
            string renamedAnimation = newName.Replace("panel", "animation");
            Assert(outputXml.Contains("<AnimationHash>" + renamedAnimation + "</AnimationHash>"),
                mode + ": animation reference must be renamed exactly once");
            Assert(!Directory.GetFiles(directory, "*.xml").Any(), mode + ": temporary XML not cleaned");
        }
        finally
        {
            Directory.Delete(directory, true);
        }
    }
}
