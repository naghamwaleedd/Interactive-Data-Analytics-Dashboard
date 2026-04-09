using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace final.Models
{
    
        public class Response
        {
            [Key]
            public int Response_ID { get; set; }
            public int Option_ID { get; set; }
            public int Request_ID { get; set; }
            public int Question_ID { get; set; }
            public DateTime? CreateDate { get; set; }
           
            public string? sentiment_text { get; set; }
        public int? sentiment_score { get; set; }

        }
    public class sent
    {
        public double sentimentperc { get; set; }   
        public string sentimentkey { get; set; }
    }

    public class ResponseModel
        {
            public int returncode { get; set; }
            public string returnDescription { get; set; }
            public List<sent>data { get; set; }
        }
    
}
