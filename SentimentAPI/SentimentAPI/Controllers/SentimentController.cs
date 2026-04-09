using Microsoft.AspNetCore.Mvc;
using SentimentAPI.Services;

namespace SentimentAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SentimentController : ControllerBase
    {
        private readonly SentimentService _sentimentService;

        public SentimentController()
        {
            _sentimentService = new SentimentService();
        }

        [HttpPost]
        public IActionResult Analyze([FromBody] SentimentInput input)
        {
            if (string.IsNullOrWhiteSpace(input.Text))
                return BadRequest("Text cannot be empty");

            var result = _sentimentService.Predict(input.Text);

            return Ok(new
            {
                SentimentScore = result.Score,
                SentimentText = result.Sentiment
            });
        }
    }
}
