using final.Models;
using Microsoft.EntityFrameworkCore;
using static final.Models.Response;

namespace final.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<Response> Responses { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)

        {

            modelBuilder.Entity<Response>()

                .ToTable("Response") // map class to table

                .HasKey(e => e.Response_ID);

        }

    }
}