using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using SentimentAPI.Model;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace SentimentAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SentimentToDBController : ControllerBase
    {
        private readonly string _connectionString = "Server=NAGHAM\\SQLEXPRESS;Database=SurveyAnsDB;Trusted_Connection=True;TrustServerCertificate=True";
        private readonly HttpClient _httpClient = new HttpClient();

        [HttpGet("Run")]
        public async Task<IActionResult> Run()
        {
            List<(int Response_ID, string Answer)> rows = new List<(int, string)>();

            using (SqlConnection conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync();

                // Step 1: Select rows to process
                string selectQuery = "SELECT Response_ID, Answer FROM dbo.Response WHERE isSend = 0 OR isSend IS NULL";
                using (SqlCommand selectCmd = new SqlCommand(selectQuery, conn))
                using (SqlDataReader reader = await selectCmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        int Response_ID = reader.GetInt32(0);
                        string answer = reader.IsDBNull(1) ? null : reader.GetString(1);
                        rows.Add((Response_ID, answer));
                    }
                } // Reader closes here, but connection remains open

                Console.WriteLine($"Total rows fetched: {rows.Count}");

                // Step 2: Process each row (connection is still open)
                foreach (var row in rows)
                {
                    Console.WriteLine($"Processing Response_ID={row.Response_ID}, Answer='{row.Answer}'");

                    if (string.IsNullOrWhiteSpace(row.Answer))
                    {
                        int rowsUpdated = await UpdateResponseAsync(conn, row.Response_ID, -1, "No Answer, returned score: -1");
                        Console.WriteLine($"Updated NULL Answer: Response_ID={row.Response_ID}, Rows affected={rowsUpdated}");
                        continue;
                    }

                    try
                    {
                        var sentiment = await GetSentimentAsync(row.Answer);
                        Console.WriteLine($"API returned: Score={sentiment.Score}, Text={sentiment.Text}");

                        int rowsUpdated = await UpdateResponseAsync(conn, row.Response_ID, sentiment.Score, sentiment.Text);
                        Console.WriteLine($"Updated Response_ID={row.Response_ID}, Rows affected={rowsUpdated}");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error processing Response_ID {row.Response_ID}: {ex.Message}");
                        Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                        continue;
                    }
                }
            } // Connection closes here

            return Ok("Sentiment processing completed. Check console logs for details.");
        }

        private async Task<(int Score, string Text)> GetSentimentAsync(string sentence)
        {
            var payload = new { Text = sentence };
            var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

            try
            {
                HttpResponseMessage response = await _httpClient.PostAsync("https://localhost:7147/api/Sentiment", content);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Raw API response for text '{sentence}': {json}");

                var result = JsonConvert.DeserializeObject<SentimentResponse>(json);
                return (result.SentimentScore, result.SentimentText);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"API call failed for text '{sentence}': {ex.Message}");
                Console.WriteLine($"API Stack Trace: {ex.StackTrace}");
                throw;
            }
        }

        private async Task<int> UpdateResponseAsync(SqlConnection conn, int Response_ID, int score, string text)
        {
            Console.WriteLine($"UpdateResponseAsync called for Response_ID={Response_ID}, score={score}, text={text}");

            string updateQuery = @"
        UPDATE dbo.Response
        SET sentiment_score = @Score,
            sentiment_text = @Text,
            isSend = 1
        WHERE Response_ID = @Response_ID";

            using (SqlCommand updateCmd = new SqlCommand(updateQuery, conn))
            {
                updateCmd.Parameters.AddWithValue("@Score", score);
                updateCmd.Parameters.AddWithValue("@Text", text ?? (object)DBNull.Value);
                updateCmd.Parameters.AddWithValue("@Response_ID", Response_ID);

                try
                {
                    Console.WriteLine($"Executing SQL update for Response_ID={Response_ID}");
                    int rowsAffected = await updateCmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"SQL update completed. Rows affected: {rowsAffected}");

                    if (rowsAffected == 0)
                    {
                        Console.WriteLine($"WARNING: No rows updated for Response_ID={Response_ID}. Record may not exist.");
                    }

                    return rowsAffected;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Database update failed for Response_ID {Response_ID}: {ex.Message}");
                    Console.WriteLine($"DB Stack Trace: {ex.StackTrace}");
                    throw;
                }
            }
        }
    }
}