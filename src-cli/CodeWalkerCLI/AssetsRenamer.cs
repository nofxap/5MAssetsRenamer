using System;
using System.IO;
using System.Xml;
using System.Linq;
using System.Text;
using System.Threading;
using CodeWalker.GameFiles;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace CodeWalkerCLI
{
    public class AssetsRenamer
    {
        private RenameOptions _options;
        private RenameResult _result;
        private Dictionary<string, string> _renameMap;
        private Dictionary<uint, string> _hashToOldName;
        private Dictionary<uint, string> _hashToNewName;
        private HashSet<string> _processedFiles;
        private HashSet<string> _renamedFiles;
        private List<string> _xmlFilesToClean;
        private HashSet<string> _allRegisteredStrings;
        private bool _isPrefixSuffixMode;

        public AssetsRenamer(RenameOptions options)
        {
            _options = options;
            _result = new RenameResult();
            _renameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            _hashToOldName = new Dictionary<uint, string>();
            _hashToNewName = new Dictionary<uint, string>();
            _processedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _renamedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _xmlFilesToClean = new List<string>();
            _allRegisteredStrings = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        public RenameResult Execute()
        {
            PrintHeader();

            if (!LoadRenameMappings())
            {
                _result.Success = false;
                return _result;
            }

            PrepareOutputDirectory();

            var workingPath = _options.ReplaceOriginalFiles ? _options.InputPath : _options.OutputPath;
            var allFiles = Directory.GetFiles(workingPath, "*", SearchOption.AllDirectories).ToList();

            _result.TotalFiles = allFiles.Count;
            Log($"Found {allFiles.Count} total files", ConsoleColor.Cyan);

            if (_renameMap.Count > 0)
            {
                BuildCompleteHashMappings(workingPath);
                RenamePhysicalFiles(workingPath);
            }

            if (_renameMap.Count > 0)
            {
                ProcessMetadata(workingPath);
                ProcessTextFiles(workingPath);
            }

            EnsureAllStringsInJenkIndex();

            RepackModifiedFiles();
            CleanupTempFiles();

            PrintSummary();

            _result.Success = true;
            return _result;
        }

        private void PrintHeader()
        {
            Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine("=".PadRight(60, '='));
            Console.WriteLine("CodeWalker CLI - GTA V Asset Renamer");
            Console.WriteLine("=".PadRight(60, '='));
            Console.ResetColor();
            Console.WriteLine();
        }

        private bool LoadRenameMappings()
        {
            var findText = _options.FindText;

            if (string.IsNullOrEmpty(findText))
            {
                LogError("Find text (-f) is mandatory for renaming operations.");
                return false;
            }

            if (!string.IsNullOrEmpty(_options.ReplaceText))
            {
                _renameMap[findText] = _options.ReplaceText;
                Log($"Search/Replace: '{findText}' => '{_options.ReplaceText}'", ConsoleColor.Green);
            }
            else if (!string.IsNullOrEmpty(_options.PrefixText) || !string.IsNullOrEmpty(_options.SuffixText))
            {
                _isPrefixSuffixMode = true;
                var newName = $"{_options.PrefixText}{findText}{_options.SuffixText}";
                _renameMap[findText] = newName;
                Log($"Prefix/Suffix Mode: Find='{findText}' => New Pattern='{newName}'", ConsoleColor.Green);
            }
            else
            {
                LogError("Missing replacement argument (-r, -p, or -s).");
                return false;
            }

            if (_options.Debug && _renameMap.Count > 0)
            {
                foreach (var kvp in _renameMap)
                    DebugLog($"  {kvp.Key} => {kvp.Value}");
            }

            return _renameMap.Count > 0;
        }

        private void PrepareOutputDirectory()
        {
            if (!_options.ReplaceOriginalFiles)
            {
                if (Directory.Exists(_options.OutputPath))
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.Write("Output directory exists. Overwrite? (y/n): ");
                    Console.ResetColor();

                    if (Console.ReadLine()?.Trim().ToLower() != "y")
                    {
                        Console.WriteLine("Cancelled");
                        Environment.Exit(0);
                    }

                    Directory.Delete(_options.OutputPath, true);
                }

                Log("Copying to output directory...", ConsoleColor.Cyan);
                CopyDirectory(_options.InputPath, _options.OutputPath);
                Log("Copy complete", ConsoleColor.Green);
            }
        }

        private void RegisterString(string str)
        {
            if (string.IsNullOrEmpty(str)) return;

            _allRegisteredStrings.Add(str);
            JenkIndex.Ensure(str);

            var lower = str.ToLowerInvariant();
            if (lower != str)
            {
                _allRegisteredStrings.Add(lower);
                JenkIndex.Ensure(lower);
            }
        }

        private void BuildCompleteHashMappings(string basePath)
        {
            Log("Building hash mappings...", ConsoleColor.Cyan);

            foreach (var kvp in _renameMap)
            {
                var oldHash = JenkHash.GenHash(kvp.Key);
                _hashToOldName[oldHash] = kvp.Key;

                if (!_isPrefixSuffixMode)
                {
                    _hashToNewName[oldHash] = kvp.Value;
                }

                RegisterString(kvp.Key);
                RegisterString(kvp.Value);
                DebugLog($"  Base: 0x{oldHash:X8} {kvp.Key} => {kvp.Value}");
            }

            var allFiles = Directory.GetFiles(basePath, "*", SearchOption.AllDirectories);

            foreach (var file in allFiles)
            {
                var nameWithoutExt = Path.GetFileNameWithoutExtension(file);
                var originalHash = JenkHash.GenHash(nameWithoutExt);

                if (!_hashToOldName.ContainsKey(originalHash))
                {
                    _hashToOldName[originalHash] = nameWithoutExt;
                    RegisterString(nameWithoutExt);
                }

                var shouldRename = false;
                var newNameWithoutExt = nameWithoutExt;
                var matchedKvp = _renameMap.FirstOrDefault(kvp => nameWithoutExt.IndexOf(kvp.Key, StringComparison.OrdinalIgnoreCase) >= 0);

                if (matchedKvp.Key != null)
                {
                    var oldName = matchedKvp.Key;
                    var newPattern = matchedKvp.Value;

                    if (_isPrefixSuffixMode)
                    {
                        newNameWithoutExt = Regex.Replace(nameWithoutExt, Regex.Escape(oldName),
                                                         (match) => {
                                                             return $"{_options.PrefixText}{match.Value}{_options.SuffixText}";
                                                         },
                                                         RegexOptions.IgnoreCase);
                    }
                    else
                    {
                        newNameWithoutExt = Regex.Replace(nameWithoutExt, Regex.Escape(oldName), newPattern, RegexOptions.IgnoreCase);
                    }
                    shouldRename = true;
                }

                if (shouldRename && newNameWithoutExt != nameWithoutExt)
                {
                    var newHash = JenkHash.GenHash(newNameWithoutExt);
                    if (!_hashToNewName.ContainsKey(originalHash))
                    {
                        _hashToNewName[originalHash] = newNameWithoutExt;
                        RegisterString(newNameWithoutExt);
                        DebugLog($"  File: 0x{originalHash:X8} {nameWithoutExt} => {newNameWithoutExt}");
                    }
                    if (!_hashToNewName.ContainsKey(newHash))
                    {
                        _hashToNewName[newHash] = newNameWithoutExt;
                        RegisterString(newNameWithoutExt);
                    }
                }
            }

            Log($"Built {_hashToNewName.Count} hash mappings", ConsoleColor.Green);
        }

        private string ApplyAllRenameMappings(string input)
        {
            var result = input;

            foreach (var kvp in _renameMap)
            {
                var oldName = kvp.Key;
                var newPattern = kvp.Value;

                if (result.IndexOf(oldName, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    if (_isPrefixSuffixMode)
                    {
                        result = Regex.Replace(result, Regex.Escape(oldName),
                                               (match) => {
                                                   return $"{_options.PrefixText}{match.Value}{_options.SuffixText}";
                                               },
                                               RegexOptions.IgnoreCase);
                    }
                    else
                    {
                        result = Regex.Replace(result, Regex.Escape(oldName), newPattern, RegexOptions.IgnoreCase);
                    }
                }
            }

            return result;
        }

        private void RenamePhysicalFiles(string basePath)
        {
            Log("Renaming physical files...", ConsoleColor.Cyan);

            var allFiles = Directory.GetFiles(basePath, "*", SearchOption.AllDirectories)
                .OrderByDescending(f => f.Length)
                .ToList();

            int renamedCount = 0;

            foreach (var oldPath in allFiles)
            {
                if (!File.Exists(oldPath)) continue;

                var dir = Path.GetDirectoryName(oldPath);
                var name = Path.GetFileNameWithoutExtension(oldPath);
                var ext = Path.GetExtension(oldPath);

                var newName = ApplyAllRenameMappings(name);

                if (newName != name)
                {
                    var newPath = Path.Combine(dir, newName + ext);

                    if (!File.Exists(newPath))
                    {
                        try
                        {
                            File.Move(oldPath, newPath);
                            renamedCount++;
                            _renamedFiles.Add(newPath);
                            _processedFiles.Add(newPath);
                            RegisterString(newName);
                            DebugLog($"RENAMED: {name}{ext} => {newName}{ext}");
                        }
                        catch (Exception ex)
                        {
                            LogError($"Rename failed {name}{ext}: {ex.Message}");
                        }
                    }
                    else
                    {
                        LogError($"Rename target already exists: {newName}{ext}");
                    }
                }
            }

            _result.RenamedFiles = renamedCount;
            Log($"Renamed {renamedCount} files", ConsoleColor.Green);
        }

        private void ProcessMetadata(string basePath)
        {
            Log("Processing metadata files...", ConsoleColor.Cyan);

            var metadataFiles = new List<string>();
            metadataFiles.AddRange(Directory.GetFiles(basePath, "*.ytyp", SearchOption.AllDirectories));
            metadataFiles.AddRange(Directory.GetFiles(basePath, "*.ymap", SearchOption.AllDirectories));
            metadataFiles.AddRange(Directory.GetFiles(basePath, "*.ymf", SearchOption.AllDirectories));
            metadataFiles.AddRange(Directory.GetFiles(basePath, "*.ycd", SearchOption.AllDirectories));

            int total = metadataFiles.Count;
            int current = 0;

            foreach (var file in metadataFiles.Distinct())
            {
                var ext = Path.GetExtension(file).ToLower().TrimStart('.');
                ProcessMetadataFile(file, ext);

                current++;
                UpdateProgress(current, total);
            }

            Console.WriteLine();
        }

        private void ProcessTextFiles(string basePath)
        {
            Log("Processing text/script files (.meta, .xml, .lua)...", ConsoleColor.Cyan);

            var textFiles = new List<string>();
            textFiles.AddRange(Directory.GetFiles(basePath, "*.meta", SearchOption.AllDirectories));
            textFiles.AddRange(Directory.GetFiles(basePath, "*.xml", SearchOption.AllDirectories));
            textFiles.AddRange(Directory.GetFiles(basePath, "*.lua", SearchOption.AllDirectories));

            int total = textFiles.Count;
            int current = 0;

            foreach (var file in textFiles.Distinct())
            {
                ProcessTextFile(file);

                current++;
                UpdateProgress(current, total);
            }

            Console.WriteLine();
        }

        private void ProcessMetadataFile(string binaryPath, string fileType)
        {
            var xmlPath = binaryPath + ".xml";

            try
            {
                byte[] data = File.ReadAllBytes(binaryPath);
                string xml = null;

                switch (fileType)
                {
                    case "ytyp":
                        var ytyp = new YtypFile();
                        ytyp.Load(data);
                        if (ytyp?.Meta != null || ytyp?.Pso != null)
                        {
                            string xmlFilename;
                            xml = MetaXml.GetXml(ytyp, out xmlFilename);
                        }
                        break;

                    case "ymap":
                        var ymap = new YmapFile();
                        ymap.Load(data);
                        if (ymap?.Meta != null || ymap?.Pso != null)
                        {
                            string xmlFilename;
                            xml = MetaXml.GetXml(ymap, out xmlFilename);
                        }
                        break;

                    case "ymf":
                        var ymf = new YmfFile();
                        ymf.Load(data, null);
                        if (ymf?.Pso != null || ymf?.Meta != null)
                        {
                            string xmlFilename;
                            xml = MetaXml.GetXml(ymf, out xmlFilename);
                        }
                        break;

                    case "ycd":
                        var ycd = new YcdFile();
                        RpfFile.LoadResourceFile(ycd, data, 46);
                        if (ycd?.ClipDictionary != null)
                        {
                            ycd.InitDictionaries();
                            xml = YcdXml.GetXml(ycd);
                        }
                        break;

                    case "ybn":
                        var ybn = new YbnFile();
                        RpfFile.LoadResourceFile(ybn, data, 43);
                        if (ybn?.Bounds != null)
                            xml = YbnXml.GetXml(ybn);
                        break;
                }

                if (string.IsNullOrEmpty(xml))
                    return;

                int replacementCount;
                var modifiedXml = ProcessXmlContent(xml, Path.GetFileName(binaryPath), out replacementCount);

                if (replacementCount > 0)
                {
                    File.WriteAllText(xmlPath, modifiedXml, Encoding.UTF8);
                    _xmlFilesToClean.Add(xmlPath);
                    _processedFiles.Add(binaryPath);
                    _result.ReplacedStrings += replacementCount;
                    Log($"XML METADATA: {Path.GetFileName(binaryPath)} - Temp XML generated ({replacementCount} changes)", ConsoleColor.Yellow);
                }
            }
            catch (Exception ex)
            {
                LogError($"{fileType.ToUpper()}: {Path.GetFileName(binaryPath)} - {ex.Message}");
                if (_options.Debug)
                    DebugLog($"  {ex.StackTrace}", ConsoleColor.Red);
            }
        }

        private void ExtractAndRegisterStringsFromXml(string xml)
        {
            var stringPattern = @">([^<>]+)<";
            var matches = Regex.Matches(xml, stringPattern);

            foreach (Match match in matches)
            {
                var value = match.Groups[1].Value.Trim();
                if (!string.IsNullOrEmpty(value) && !value.StartsWith("hash_") && value.Length < 256)
                {
                    if (!value.Contains(" ") && !value.Contains("\n") && !value.Contains("\r"))
                    {
                        RegisterString(value);
                    }
                }
            }

            var attrPattern = @"=""([^""]+)""";
            var attrMatches = Regex.Matches(xml, attrPattern);

            foreach (Match match in attrMatches)
            {
                var value = match.Groups[1].Value.Trim();
                if (!string.IsNullOrEmpty(value) && !value.StartsWith("hash_") && value.Length < 256)
                {
                    if (!value.Contains(" "))
                    {
                        RegisterString(value);
                    }
                }
            }
        }

        private string ProcessXmlContent(string xml, string filename, out int totalReplacements)
        {
            if (string.IsNullOrEmpty(xml))
            {
                totalReplacements = 0;
                return xml;
            }

            var modified = xml;
            int replacements = 0;
            var replacementLog = new List<string>();

            var hashPattern = @"hash_([0-9A-Fa-f]{8})";
            var hashMatches = Regex.Matches(xml, hashPattern);

            foreach (Match match in hashMatches)
            {
                var hashStr = match.Groups[1].Value;
                if (uint.TryParse(hashStr, System.Globalization.NumberStyles.HexNumber, null, out uint hashValue))
                {
                    if (_hashToNewName.ContainsKey(hashValue))
                    {
                        var fullMatch = match.Value;
                        var newName = _hashToNewName[hashValue];
                        modified = modified.Replace(fullMatch, newName);
                        replacements++;
                        RegisterString(newName);

                        if (_options.Debug)
                        {
                            var oldName = _hashToOldName.ContainsKey(hashValue) ? _hashToOldName[hashValue] : "";
                            replacementLog.Add($"    HASH: {fullMatch} ({oldName}) => {newName}");
                        }
                    }
                }
            }

            foreach (var kvp in _renameMap)
            {
                var oldName = kvp.Key;
                var newPattern = kvp.Value;

                var beforeCount = Regex.Matches(modified, Regex.Escape(oldName), RegexOptions.IgnoreCase).Count;

                if (beforeCount > 0)
                {
                    if (_isPrefixSuffixMode)
                    {
                        modified = Regex.Replace(modified, Regex.Escape(oldName),
                                                (match) => {
                                                    var result = $"{_options.PrefixText}{match.Value}{_options.SuffixText}";
                                                    RegisterString(result);
                                                    return result;
                                                },
                                                RegexOptions.IgnoreCase);
                    }
                    else
                    {
                        modified = Regex.Replace(modified, Regex.Escape(oldName), newPattern, RegexOptions.IgnoreCase);
                        RegisterString(newPattern);
                    }

                    replacements += beforeCount;

                    if (_options.Debug)
                    {
                        replacementLog.Add($"    GLOBAL: '{oldName}' => '{newPattern}' ({beforeCount} occurrences)");
                    }
                }
            }

            ExtractAndRegisterStringsFromXml(modified);

            totalReplacements = replacements;

            if (_options.Debug && totalReplacements > 0)
            {
                DebugLog($"  {filename}: {totalReplacements} replacements", ConsoleColor.Cyan);
                foreach (var logEntry in replacementLog.Take(10))
                    DebugLog(logEntry);
                if (replacementLog.Count > 10)
                    DebugLog($"    ... and {replacementLog.Count - 10} more");
            }

            return modified;
        }

        private void ProcessTextFile(string path)
        {
            try
            {
                var content = File.ReadAllText(path);
                var original = content;
                int replacements = 0;

                foreach (var kvp in _renameMap)
                {
                    var oldName = kvp.Key;
                    var newPattern = kvp.Value;

                    var count = Regex.Matches(content, Regex.Escape(oldName), RegexOptions.IgnoreCase).Count;

                    if (count > 0)
                    {
                        if (_isPrefixSuffixMode)
                        {
                            content = Regex.Replace(content, Regex.Escape(oldName),
                                                (match) => {
                                                    var result = $"{_options.PrefixText}{match.Value}{_options.SuffixText}";
                                                    RegisterString(result);
                                                    return result;
                                                },
                                                RegexOptions.IgnoreCase);
                        }
                        else
                        {
                            content = Regex.Replace(content, Regex.Escape(oldName), newPattern, RegexOptions.IgnoreCase);
                            RegisterString(newPattern);
                        }
                        replacements += count;
                    }

                    var oldHash = JenkHash.GenHash(oldName);
                    var hashStr = $"0x{oldHash:X8}";
                    if (content.Contains(hashStr))
                    {
                        if (_hashToNewName.ContainsKey(oldHash))
                        {
                            var newName = _hashToNewName[oldHash];
                            content = content.Replace(hashStr, newName);
                            replacements++;
                            RegisterString(newName);
                        }
                    }
                }

                if (content != original)
                {
                    File.WriteAllText(path, content, Encoding.UTF8);
                    _processedFiles.Add(path);
                    _result.ReplacedStrings += replacements;
                    Log($"TEXT: {Path.GetFileName(path)} - Updated ({replacements} changes)", ConsoleColor.Green);
                }
            }
            catch (Exception ex)
            {
                LogError($"Text file error {Path.GetFileName(path)}: {ex.Message}");
            }
        }

        private void EnsureAllStringsInJenkIndex()
        {
            Log($"Registering {_allRegisteredStrings.Count} strings in JenkIndex...", ConsoleColor.Cyan);

            foreach (var str in _allRegisteredStrings)
            {
                JenkIndex.Ensure(str);
            }

            foreach (var kvp in _hashToNewName)
            {
                JenkIndex.Ensure(kvp.Value);
            }

            foreach (var kvp in _hashToOldName)
            {
                JenkIndex.Ensure(kvp.Value);
            }
        }

        private void RepackModifiedFiles()
        {
            var xmlFilesToRepack = _xmlFilesToClean;

            if (xmlFilesToRepack.Count == 0) return;

            Log($"Repacking {xmlFilesToRepack.Count} files...", ConsoleColor.Cyan);

            EnsureAllStringsInJenkIndex();

            int repacked = 0;
            int failed = 0;

            foreach (var xmlPath in xmlFilesToRepack)
            {
                try
                {
                    var binaryPath = xmlPath.Substring(0, xmlPath.Length - 4);
                    if (!File.Exists(binaryPath))
                    {
                        DebugLog($"  Binary not found for {Path.GetFileName(xmlPath)}, skipping", ConsoleColor.Yellow);
                        continue;
                    }

                    var ext = Path.GetExtension(binaryPath).ToLower().TrimStart('.');
                    var xmlContent = File.ReadAllText(xmlPath);

                    ExtractAndRegisterStringsFromXml(xmlContent);
                    EnsureAllStringsInJenkIndex();

                    var xmlDoc = new XmlDocument();
                    xmlDoc.LoadXml(xmlContent);

                    byte[] newData = null;

                    switch (ext)
                    {
                        case "ytyp":
                        case "ymap":
                            {
                                var meta = XmlMeta.GetMeta(xmlDoc);
                                if (meta != null)
                                    newData = ResourceBuilder.Build(meta, 2);
                            }
                            break;

                        case "ymf":
                            {
                                var pso = XmlPso.GetPso(xmlDoc);
                                if (pso != null)
                                    newData = pso.Save();
                            }
                            break;

                        case "ycd":
                            {
                                var ycd = XmlYcd.GetYcd(xmlDoc);
                                if (ycd != null)
                                {
                                    ycd.InitDictionaries();
                                    newData = ycd.Save();
                                }
                            }
                            break;

                        case "ybn":
                            {
                                newData = XmlMeta.GetYbnData(xmlDoc);
                                if (newData != null)
                                {
                                    var ybn = new YbnFile();
                                    RpfFile.LoadResourceFile(ybn, newData, 43);
                                    newData = ybn.Save();
                                }
                            }
                            break;

                        default:
                            DebugLog($"  Skipping unsupported file type: {ext.ToUpper()}", ConsoleColor.Yellow);
                            continue;
                    }

                    if (newData != null && newData.Length > 0)
                    {
                        var originalSize = new FileInfo(binaryPath).Length;

                        File.Delete(binaryPath);
                        Thread.Sleep(50);
                        File.WriteAllBytes(binaryPath, newData);

                        repacked++;

                        var sizeChange = newData.Length - originalSize;
                        var sizeChangeStr = sizeChange >= 0 ? $"+{sizeChange}" : sizeChange.ToString();

                        Log($"{ext.ToUpper()}: {Path.GetFileName(binaryPath)} - Repacked ({newData.Length} bytes, {sizeChangeStr})", ConsoleColor.Green);
                    }
                    else
                    {
                        failed++;
                        LogError($"Failed to repack {ext.ToUpper()}: {Path.GetFileName(binaryPath)} - No data generated");
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    LogError($"Repack error: {ex.Message}");
                    if (_options.Debug)
                        DebugLog($"  {ex.StackTrace}", ConsoleColor.Red);
                }
            }

            Log($"Repacked: {repacked} | Failed: {failed}", repacked > 0 ? ConsoleColor.Green : ConsoleColor.Yellow);
        }

        private void CleanupTempFiles()
        {
            var xmlFilesToClean = _xmlFilesToClean;

            if (xmlFilesToClean.Count == 0) return;

            Log("Cleaning up temporary files...", ConsoleColor.Cyan);

            int deletedXmls = 0;

            foreach (var xmlFile in xmlFilesToClean)
            {
                try
                {
                    if (File.Exists(xmlFile))
                    {
                        File.Delete(xmlFile);
                        deletedXmls++;
                        DebugLog($"  Deleted XML: {Path.GetFileName(xmlFile)}", ConsoleColor.Gray);
                    }
                }
                catch (Exception ex)
                {
                    DebugLog($"  Failed to clean {Path.GetFileName(xmlFile)}: {ex.Message}", ConsoleColor.Yellow);
                }
            }

            if (deletedXmls > 0)
            {
                Log($"Cleanup complete: {deletedXmls} XML files deleted", ConsoleColor.Green);
            }
        }

        private void PrintSummary()
        {
            _result.ProcessedFiles = _processedFiles.Count;

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine("=".PadRight(60, '='));
            Console.WriteLine("SUMMARY");
            Console.WriteLine("=".PadRight(60, '='));
            Console.ResetColor();

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"Total Files:          {_result.TotalFiles}");

            if (_result.ProcessedFiles > 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
            }
            Console.WriteLine($"Processed Files:      {_result.ProcessedFiles}");
            Console.WriteLine($"Renamed Files:        {_result.RenamedFiles}");

            if (_result.ReplacedStrings > 0)
            {
                Console.ForegroundColor = ConsoleColor.Green;
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
            }
            Console.WriteLine($"Replaced Strings:     {_result.ReplacedStrings}");
            Console.ResetColor();

            if (_result.Errors > 0)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"Errors:               {_result.Errors}");
                Console.ResetColor();
            }

            Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine("=".PadRight(60, '='));
            Console.ResetColor();
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            Directory.CreateDirectory(destDir);

            foreach (var file in Directory.GetFiles(sourceDir))
                File.Copy(file, Path.Combine(destDir, Path.GetFileName(file)), true);

            foreach (var dir in Directory.GetDirectories(sourceDir))
                CopyDirectory(dir, Path.Combine(destDir, Path.GetFileName(dir)));
        }

        private void UpdateProgress(int current, int total)
        {
            if (!_options.Debug)
            {
                var percent = (int)((double)current / total * 100);
                Console.Write($"\rProgress: {current}/{total} ({percent}%)    ");
            }
        }

        private void Log(string message, ConsoleColor color = ConsoleColor.White)
        {
            Console.ForegroundColor = color;
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {message}");
            Console.ResetColor();
        }

        private void DebugLog(string message, ConsoleColor color = ConsoleColor.Gray)
        {
            if (_options.Debug)
            {
                Console.ForegroundColor = color;
                Console.WriteLine(message);
                Console.ResetColor();
            }
        }

        private void LogError(string message)
        {
            _result.Errors++;
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ERROR: {message}");
            Console.ResetColor();
        }
    }
}
