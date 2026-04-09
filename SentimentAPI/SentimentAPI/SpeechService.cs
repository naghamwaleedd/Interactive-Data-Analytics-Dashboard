using System.Diagnostics;
using System.Text.Json;

namespace SentimentAPI.Services
{
    public class SpeechResult
    {
        public string Text { get; set; } = string.Empty;
    }

    public class SpeechService
    {
        private readonly string _pythonPath = "python";
        private readonly string _scriptPath = "C:\\Users\\nagha\\OneDrive\\Desktop\\New folder\\AI_Models[1]\\AI_Models\\SppechCall.py";

        public SpeechResult Transcribe(string audioPath)
        {
            var psi = new ProcessStartInfo
            {
                FileName = _pythonPath,
                Arguments = $"\"{_scriptPath}\" \"{audioPath}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            using var reader = process.StandardOutput;
            string result = reader.ReadToEnd();
            process.WaitForExit();

            var speech = JsonSerializer.Deserialize<SpeechResult>(result);
            return speech!;
        }
    }
}
