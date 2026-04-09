using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using SentimentAPI.Services;

namespace SentimentAPI.Controllers
{
    [ApiController]
    [Route("api/Keyword")] // URL: /api/Keyword

    public class KeywordController : ControllerBase
    {
        private readonly KeywordService _keywordService = new KeywordService();
        private readonly string _connectionString = "Server=NAGHAM\\SQLEXPRESS;Database=SurveyAnsDB;Trusted_Connection=True;TrustServerCertificate=True";

        [HttpGet]
        public IActionResult Analyze([FromQuery] DateTime from, [FromQuery] DateTime to)
        {
            if (from >= to)
                return BadRequest("'from' date must be earlier than 'to' date.");

            try
            {
                // ✅ Fetch sentences from DB and store in a List<string>
                List<string> sentences = new List<string>();
                using (var connection = new SqlConnection(_connectionString))
                {
                    connection.Open();
                    string query = @"SELECT Answer FROM Response 
                             WHERE CreateDate >= @from AND CreateDate <= @to";
                    using (var cmd = new SqlCommand(query, connection))
                    {
                        cmd.Parameters.AddWithValue("@from", from);
                        cmd.Parameters.AddWithValue("@to", to);

                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                // Convert nvarchar to string safely
                                string sentence = reader["Answer"] != DBNull.Value ? (string)reader["Answer"] : "";

                                // Add it directly to the list
                                sentences.Add(sentence);
                            }
                        }
                    }
                }

                // ✅ Now sentences contains all texts in the date range
                // You can use sentences anywhere in your code before sending to Python
                var keywords = _keywordService.Predict(sentences);

                return Ok(keywords); // ✅ API return stays the same
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}
