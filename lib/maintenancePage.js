"use strict";
// Page affichée aux visiteurs tant que le site n'est pas publié (mode maintenance).
module.exports = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Site en maintenance — Bistro Burger</title>
<link rel="icon" href="data:,">
<style>
  *{ box-sizing:border-box; }
  body{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:32px 24px;
    background:linear-gradient(115deg,#12574C 0%,#0E463D 100%); color:#EDE0D3;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; text-align:center; }
  main{ max-width:520px; }
  img{ width:180px; max-width:60%; height:auto; margin-bottom:28px; }
  h1{ font-size:clamp(28px,6vw,40px); line-height:1.15; margin:0 0 16px; }
  p{ font-size:17px; line-height:1.65; margin:0 0 14px; color:rgba(237,224,211,.88); }
  a{ color:#EDE0D3; font-weight:600; }
  .contact{ margin-top:28px; padding-top:22px; border-top:1px solid rgba(237,224,211,.25); font-size:15px; }
</style>
</head>
<body>
  <main>
    <img src="/assets/logo-cream-sm.png" alt="Bistro Burger">
    <h1>Site en maintenance</h1>
    <p>Notre site fait peau neuve. Il sera de retour très bientôt.</p>
    <p>Le restaurant, lui, reste ouvert : venez nous voir ou appelez-nous.</p>
    <div class="contact">
      <p><a href="tel:+33465848918">04 65 84 89 18</a></p>
      <p>ZAC Avon, Bretelle de la Plaine<br>13120 Gardanne</p>
    </div>
  </main>
</body>
</html>
`;
