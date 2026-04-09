using final.Data;
using final.Models;
using Microsoft.AspNetCore.Mvc;
using static final.Models.Response;

namespace final.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SentimentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SentimentController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("GetSentiment")]
        public ResponseModel GetSentiment(DateTime from, DateTime to)
        {
            try
            {
                var responses = _context.Responses
                    .Where(r => r.CreateDate >= from && r.CreateDate <= to)
                    .ToList();

                if (responses.Count == 0)
                {
                    return new ResponseModel
                    {
                        returncode = 200,
                        returnDescription = "Success (no data in range)",
                        data = new List<sent>
                        {
                            new sent { sentimentkey = "Good", sentimentperc = 0 },
                            new sent { sentimentkey = "Bad", sentimentperc = 0 },
                            new sent { sentimentkey = "Neutral", sentimentperc = 0 }
                        }
                    };
                }

                int total = responses.Count;
                int goodCount = responses.Count(r => r.sentiment_text != null && r.sentiment_text.ToLower() == "good");
                int badCount = responses.Count(r => r.sentiment_text != null && r.sentiment_text.ToLower() == "bad");
                int neutralCount = responses.Count(r => r.sentiment_text != null && r.sentiment_text.ToLower() == "neutral");


                var result = new List<sent>
{
    new sent { sentimentkey = "Good", sentimentperc = Math.Round((goodCount * 100.0 / total), 0) },
    new sent { sentimentkey = "Bad", sentimentperc = Math.Round((badCount * 100.0 / total), 0) },
    new sent { sentimentkey = "Neutral", sentimentperc = Math.Round((neutralCount * 100.0 / total), 0) }
};


                return new ResponseModel
                {
                    returncode = 200,
                    returnDescription = "Success",
                    data = result
                };
            }
            catch (Exception ex)
            {
                return new ResponseModel
                {
                    returncode = 500,
                    returnDescription = "Failed: " + ex.Message,
                    data = null
                };
            }
        }
    }
}
