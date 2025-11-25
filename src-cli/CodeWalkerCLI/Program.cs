using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace CodeWalkerCLI
{
    class Program
    {
        static int Main(string[] args)
        {
            if (args.Length > 0 && (args.Contains("-h") || args.Contains("--help")))
            {
                ShowHelp();
                return 0;
            }

            RenameOptions options = null;

            if (args.Length == 0)
            {
                options = StartWizard();
            }
            else
            {
                options = ParseArguments(args);
            }

            if (options == null) return 1;

            try
            {
                var renamer = new AssetsRenamer(options);
                var result = renamer.Execute();

                return result.Success ? 0 : 1;
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"FATAL ERROR: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                Console.ResetColor();
                return 1;
            }
        }

        static void ShowHelp()
        {
            Console.WriteLine(@"
CodeWalker CLI - GTA V Asset Renamer
By: Nostradamus
=========================================================

USAGE:
  CodeWalkerCLI <inputPath> [outputPath] -f <TextToFind> [OPTIONS]

ARGUMENTS:
  <inputPath>                 Input directory containing GTA V assets.
  [outputPath]                Optional output directory. If omitted, files in inputPath are modified.

REQUIRED OPTIONS (for renaming):
  -f, --find <text>           The string to find in file names and content.
  -r, --replace <text>        The string to replace the found text with. (Mutually exclusive with -p/-s)

PREFIX/SUFFIX OPTIONS (Alternative to -r):
  -p, --prefix <text>         Text to prepend if TextToFind is found.
  -s, --suffix <text>         Text to append if TextToFind is found.

OTHER OPTIONS:
  -h, --help                  Show this help.

EXAMPLES:
  CodeWalkerCLI c://inputPath c://outputPath -f old_name -r new_name
  CodeWalkerCLI c://inputPath -f car_model -s _fixed
");
        }

        static RenameOptions ParseArguments(string[] args)
        {
            var options = new RenameOptions();
            var nonOptionArgs = new List<string>();
            var argsList = args.ToList();

            for (int i = 0; i < argsList.Count; i++)
            {
                var arg = argsList[i].ToLower();
                switch (arg)
                {
                    case "-f":
                    case "--find":
                        if (++i >= argsList.Count) return Error("Missing text for -f");
                        options.FindText = argsList[i];
                        break;
                    case "-r":
                    case "--replace":
                        if (++i >= argsList.Count) return Error("Missing text for -r");
                        options.ReplaceText = argsList[i];
                        break;
                    case "-p":
                    case "--prefix":
                        if (++i >= argsList.Count) return Error("Missing text for -p");
                        options.PrefixText = argsList[i];
                        break;
                    case "-s":
                    case "--suffix":
                        if (++i >= argsList.Count) return Error("Missing text for -s");
                        options.SuffixText = argsList[i];
                        break;
                    case "-d":
                    case "--debug":
                        options.Debug = true;
                        break;
                    default:
                        if (!arg.StartsWith("-"))
                        {
                            nonOptionArgs.Add(argsList[i]);
                        }
                        else
                        {
                            return Error($"Unknown option: {argsList[i]}");
                        }
                        break;
                }
            }

            if (nonOptionArgs.Count == 0) return Error("Input path is required");

            options.InputPath = nonOptionArgs[0];
            if (nonOptionArgs.Count > 1)
            {
                options.OutputPath = nonOptionArgs[1];
            }

            if (!Directory.Exists(options.InputPath))
            {
                return Error("Input directory does not exist");
            }

            if (string.IsNullOrEmpty(options.FindText))
            {
                return Error("-f (TextToFind) is required for renaming operations");
            }

            int modeCount = 0;
            if (!string.IsNullOrEmpty(options.ReplaceText)) modeCount++;
            if (!string.IsNullOrEmpty(options.PrefixText)) modeCount++;
            if (!string.IsNullOrEmpty(options.SuffixText)) modeCount++;

            if (modeCount == 0)
            {
                return Error("One of -r, -p, or -s is required to define the renaming operation");
            }

            if (modeCount > 1)
            {
                return Error("Only one renaming operation (-r, -p, or -s) can be specified");
            }

            return options;
        }

        static RenameOptions StartWizard()
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("CodeWalker CLI - Asset Renamer Wizard Mode");
            Console.WriteLine("By: Nostradamus");
            Console.WriteLine("==========================================");
            Console.ResetColor();

            var options = new RenameOptions();

            while (true)
            {
                Console.Write("Enter INPUT directory (e.g., c:\\mods): ");
                options.InputPath = Console.ReadLine()?.Trim().Replace("\"", "");
                if (string.IsNullOrEmpty(options.InputPath) || !Directory.Exists(options.InputPath))
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Invalid or non-existent path. Try again.");
                    Console.ResetColor();
                    continue;
                }
                break;
            }

            Console.Write("Enter OUTPUT directory (optional, leave blank to modify in-place): ");
            options.OutputPath = Console.ReadLine()?.Trim().Replace("\"", "");
            if (string.IsNullOrWhiteSpace(options.OutputPath))
            {
                options.OutputPath = null;
                Console.WriteLine("Files will be modified in-place.");
            }

            while (true)
            {
                Console.Write("Enter FIND text (-f): ");
                options.FindText = Console.ReadLine()?.Trim();
                if (string.IsNullOrEmpty(options.FindText))
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Find text is mandatory. Try again.");
                    Console.ResetColor();
                    continue;
                }
                break;
            }

            while (true)
            {
                Console.WriteLine("\nSelect renaming mode:");
                Console.WriteLine("1. Replace (-r)");
                Console.WriteLine("2. Prefix (-p)");
                Console.WriteLine("3. Suffix (-s)");
                Console.Write("Choice (1-3): ");

                var choice = Console.ReadLine()?.Trim();

                if (choice == "1")
                {
                    Console.Write("Enter REPLACE text (-r): ");
                    options.ReplaceText = Console.ReadLine()?.Trim();
                    break;
                }
                else if (choice == "2")
                {
                    Console.Write("Enter PREFIX text (-p): ");
                    options.PrefixText = Console.ReadLine()?.Trim();
                    break;
                }
                else if (choice == "3")
                {
                    Console.Write("Enter SUFFIX text (-s): ");
                    options.SuffixText = Console.ReadLine()?.Trim();
                    break;
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("Invalid choice. Try again.");
                    Console.ResetColor();
                }
            }

            Console.WriteLine("\nOptional settings:");
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\nConfiguration complete. Starting process...");
            Console.ResetColor();

            return options;
        }

        static RenameOptions Error(string message)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"ERROR: {message}");
            Console.ResetColor();
            return null;
        }
    }

    public class RenameOptions
    {
        public string InputPath { get; set; }
        public string OutputPath { get; set; }
        public bool ReplaceOriginalFiles => string.IsNullOrEmpty(OutputPath);
        public bool Debug { get; set; }
        public string FindText { get; set; }
        public string ReplaceText { get; set; }
        public string PrefixText { get; set; }
        public string SuffixText { get; set; }
    }

    public class RenameResult
    {
        public int TotalFiles { get; set; }
        public int ProcessedFiles { get; set; }
        public int RenamedFiles { get; set; }
        public int ReplacedStrings { get; set; }
        public int Errors { get; set; }
        public bool Success { get; set; } = false;
    }
}