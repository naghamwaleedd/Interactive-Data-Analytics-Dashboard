using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace SentimentAPI.Services
{
    public class KeywordResult
    {
        public string Keyword { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    public class KeywordService
    {
        private readonly string _pythonPath = "python"; // adjust your Python path
        private readonly string _scriptPath = "C:\\Users\\nagha\\OneDrive\\Desktop\\New folder\\AI_Models\\KeywordCall.py"; // adjust your script path
        public List<KeywordResult> Predict(List<string> texts)
        {
            if (texts == null || texts.Count == 0)
                return new List<KeywordResult>();

            string jsonInput = JsonSerializer.Serialize(texts);

            var psi = new ProcessStartInfo
            {
                FileName = _pythonPath,
                Arguments = $"\"{_scriptPath}\"",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,   // ✅ fix for Arabic
                StandardErrorEncoding = Encoding.UTF8    // ✅ also fix errors encoding
            };

            using var process = Process.Start(psi);
            if (process == null)
                throw new Exception("Python process could not start.");

            // Send JSON via stdin
            process.StandardInput.WriteLine(jsonInput);
            process.StandardInput.Close();

            string output = process.StandardOutput.ReadToEnd();
            string errors = process.StandardError.ReadToEnd();

            process.WaitForExit();

            if (!string.IsNullOrEmpty(errors))
                throw new Exception($"Python error: {errors}");

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<List<KeywordResult>>(output, options);

            return result ?? new List<KeywordResult>();
        }
    }
}
