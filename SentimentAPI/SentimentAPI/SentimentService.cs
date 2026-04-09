using System.Diagnostics;
using System.Text.Json;

namespace SentimentAPI.Services
{
    public class SentimentInput
    {
        public string Text { get; set; } = string.Empty;
    }
    public class SentimentResult
    {
        public int Score { get; set; }
        public string Sentiment { get; set; } = string.Empty;
    }



    public class SentimentService
    {
        private readonly string _pythonPath = "python"; // or full path like "C:\\Python311\\python.exe"
        private readonly string _scriptPath = "C:\\Users\\nagha\\OneDrive\\Desktop\\New folder\\AI_Models\\SentimentCall.py";


        public SentimentResult Predict(string text)
        {
            // Start python process
            var psi = new ProcessStartInfo
            {
                FileName = _pythonPath,
                Arguments = $"\"{_scriptPath}\" \"{text.Replace("\"", "\\\"")}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            string output = process.StandardOutput.ReadToEnd();
            string errors = process.StandardError.ReadToEnd();
            process.WaitForExit();

            if (!string.IsNullOrWhiteSpace(errors))
                throw new Exception($"Python error: {errors}");

            if (string.IsNullOrWhiteSpace(output))
                throw new Exception("Python returned empty output.");

            var sentiment = JsonSerializer.Deserialize<SentimentResult>(output);
            return sentiment!;
        }
    }
}
