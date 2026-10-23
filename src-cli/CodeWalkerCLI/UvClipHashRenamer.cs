using System;
using System.Collections.Generic;
using System.Globalization;
using System.Xml;

namespace CodeWalkerCLI
{
    // UV clips are keyed by model hash + zero-based shader index + 1,
    // rather than by the name stored in the clip or animation.
    public sealed class UvClipHashRenamer
    {
        private readonly Func<string, uint> hashName;
        private readonly Dictionary<uint, uint> mappings = new Dictionary<uint, uint>();
        private readonly HashSet<uint> ambiguous = new HashSet<uint>();

        public UvClipHashRenamer(Func<string, uint> hashName)
        {
            this.hashName = hashName;
        }

        public void AddModel(string oldName, string newName, int shaderCount)
        {
            uint oldHash = hashName(oldName.ToLowerInvariant());
            uint newHash = hashName(newName.ToLowerInvariant());
            for (int index = 0; index < shaderCount; index++)
            {
                uint oldClip = unchecked(oldHash + (uint)index + 1);
                uint newClip = unchecked(newHash + (uint)index + 1);
                uint existing;
                if (mappings.TryGetValue(oldClip, out existing) && existing != newClip)
                    ambiguous.Add(oldClip);
                else
                    mappings[oldClip] = newClip;
            }
        }

        public string Rename(string xml, out int replacements)
        {
            replacements = 0;
            if (mappings.Count == 0) return xml;

            var document = new XmlDocument { PreserveWhitespace = true };
            document.LoadXml(xml);
            if (document.DocumentElement == null || document.DocumentElement.Name != "ClipDictionary")
                return xml;

            var uvAnimations = new HashSet<uint>();
            foreach (XmlNode animation in document.SelectNodes("/ClipDictionary/Animations/Item"))
            {
                foreach (XmlNode track in animation.SelectNodes("BoneIds/Item/Track"))
                {
                    string value = track.Attributes?["value"]?.Value;
                    if (value == "17" || value == "18")
                    {
                        uvAnimations.Add(ReadHash(animation.SelectSingleNode("Hash").InnerText));
                        break;
                    }
                }
            }

            foreach (XmlNode clip in document.SelectNodes("/ClipDictionary/Clips/Item"))
            {
                bool isUv = false;
                foreach (XmlNode reference in clip.SelectNodes(".//AnimationHash"))
                    isUv |= uvAnimations.Contains(ReadHash(reference.InnerText));
                if (!isUv) continue;

                XmlNode hash = clip.SelectSingleNode("Hash");
                if (hash == null) continue;
                uint oldHash = ReadHash(hash.InnerText);
                uint newHash;
                if (!ambiguous.Contains(oldHash) && mappings.TryGetValue(oldHash, out newHash) && oldHash != newHash)
                {
                    hash.InnerText = "hash_" + newHash.ToString("X8", CultureInfo.InvariantCulture);
                    replacements++;
                }
            }
            return replacements == 0 ? xml : document.OuterXml;
        }

        private uint ReadHash(string value)
        {
            uint hash;
            if (value.StartsWith("hash_", StringComparison.OrdinalIgnoreCase) &&
                uint.TryParse(value.Substring(5), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out hash))
                return hash;
            return hashName(value.ToLowerInvariant());
        }
    }
}
