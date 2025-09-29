using System;
using System.Threading;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

public enum RaceEmailKind
{
    NewRaceResults,
    RaceResultsUpdated
}

public static class Mail
{
    // Read these from config/env in real apps
    private const string SmtpServer = "smtp.gmail.com";
    private const int SmtpPort = 587; // STARTTLS (recommended over 465)
    private const string Username = "airprojbgroupd@gmail.com";
    private const string Password = "igss aonz gbxx dhro"; // use env/config

    private const string FromName = "STB League";
    private const string FromEmail = "airprojbgroupd@gmail.com";

    /// <summary>
    /// Sends a race-related email with selectable template and optional link.
    /// </summary>
    public static async Task SendAsync(
        int RaceId,
        string Location,
        string recipientName,
        string recipientEmail,
        RaceEmailKind kind,
        string? linkUrl = null,
        CancellationToken ct = default)
    {
        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(FromName, FromEmail));
        msg.To.Add(new MailboxAddress(recipientName, recipientEmail));

        // Subject based on template
        msg.Subject = kind switch
        {
            RaceEmailKind.NewRaceResults      => "New race results available",
            RaceEmailKind.RaceResultsUpdated  => "Race results updated",
            _ => "Airplane reservation"
        };

        // Build bodies (plain + html) based on template
        var (textBody, htmlBody) = BuildBodies(kind, RaceId, Location, recipientName, linkUrl);

        var alternative = new Multipart("alternative")
        {
            // Plaintext part first
            new TextPart("plain") { Text = textBody },
            // Then HTML part
            new TextPart("html")  { Text = htmlBody }
        };

        msg.Body = alternative;

        using var client = new SmtpClient();
        try
        {
            // Connect with STARTTLS (port 587)
            await client.ConnectAsync(SmtpServer, SmtpPort, SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(Username, Password, ct);
            await client.SendAsync(msg, ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to send email: {ex}");
            throw; // rethrow or handle as needed
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, ct);
        }
    }

    private static (string text, string html) BuildBodies(
        RaceEmailKind kind,
        int RaceId,
        string Location,
        string recipientName,
        string? linkUrl)
    {
        var linkLineText = !string.IsNullOrWhiteSpace(linkUrl)
            ? $"\nView details: {linkUrl}\n"
            : string.Empty;

        var linkLineHtml = !string.IsNullOrWhiteSpace(linkUrl)
            ? $@"<p><a href=""{HtmlEncode(linkUrl!)}"">View details</a></p>"
            : string.Empty;

        string headerText, headerHtml, introText, introHtml;

        switch (kind)
        {
            case RaceEmailKind.NewRaceResults:
                headerText = "New Race Results";
                headerHtml = "New Race Results";
                introText  = "New race results are now available.";
                introHtml  = "New race results are now available.";
                break;

            case RaceEmailKind.RaceResultsUpdated:
                headerText = "Race Results Updated";
                headerHtml = "Race Results Updated";
                introText  = "Race results have been updated.";
                introHtml  = "Race results have been updated.";
                break;

            default:
                headerText = "Airplane Reservation";
                headerHtml = "Airplane Reservation";
                introText  = "We are pleased to confirm your airplane reservation.";
                introHtml  = "We are pleased to confirm your airplane reservation.";
                break;
        }

        // Plain text (fallback)
        var text = $@"Dear {recipientName},

{introText}

Details
-------
Race: {RaceId}
Location: {Location}{linkLineText}
Best regards,
The STB Team

Contact Us:
Email: {FromEmail}
";

        // HTML (rich)
        var html = $@"
<!doctype html>
<html lang=""en"">
  <body style=""font-family:Arial,Helvetica,sans-serif;line-height:1.5;margin:0;padding:0;background:#f7f7f7;"">
    <div style=""max-width:620px;margin:24px auto;background:#ffffff;border-radius:8px;padding:24px;"">
      <h2 style=""margin-top:0;"">{HtmlEncode(headerHtml)}</h2>
      <p>Dear {HtmlEncode(recipientName)},</p>
      <p>{HtmlEncode(introHtml)}</p>

      <table role=""presentation"" style=""border-collapse:collapse;width:100%;margin:16px 0;"">
        <tr>
          <td style=""padding:8px;border:1px solid #e5e7eb;width:220px;font-weight:bold;"">Race Id</td>
          <td style=""padding:8px;border:1px solid #e5e7eb;"">{RaceId}</td>
        </tr>
        <tr>
          <td style=""padding:8px;border:1px solid #e5e7eb;font-weight:bold;"">Location</td>
          <td style=""padding:8px;border:1px solid #e5e7eb;"">{HtmlEncode(Location)}</td>
        </tr>
      </table>

      {linkLineHtml}

      <p>Best regards,<br/>The STB Team</p>
      <hr style=""border:none;border-top:1px solid #e5e7eb;margin:24px 0;""/>
      <p style=""font-size:12px;color:#6b7280;"">
        Contact Us: <a href=""mailto:{FromEmail}"">{FromEmail}</a>
      </p>
    </div>
  </body>
</html>";

        return (text, html);
    }

    // Minimal HTML encoder for dynamic bits
    private static string HtmlEncode(string s) =>
        s.Replace("&", "&amp;")
         .Replace("<", "&lt;")
         .Replace(">", "&gt;")
         .Replace("\"", "&quot;");
}
