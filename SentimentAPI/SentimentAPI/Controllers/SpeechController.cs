using Microsoft.AspNetCore.Mvc;
using SentimentAPI.Services;

namespace SentimentAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SpeechController : Controller
    {
        private readonly SpeechService _speechService;

        public SpeechController()
        {
            _speechService = new SpeechService();
        }

        [HttpPost]
        public async Task<IActionResult> Transcribe(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No audio file uploaded");

            // Save the uploaded file temporarily
            var filePath = Path.GetTempFileName();
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Call Python to process the audio
            var result = _speechService.Transcribe(filePath);

            // Delete the temporary file
            System.IO.File.Delete(filePath);

            return Ok(new
            {
                Text = result.Text
            });
        }
    }
}
