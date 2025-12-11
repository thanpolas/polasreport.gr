---
layout: default
description: "Personal notes and reports"
permalink: /
---

Καλώς ήρθατε στο polasreport.gr

Δεν υπάρχουν πολλά πράγματα ακόμα, προς το παρών τα στοιχεία μου και αρχεία από τα βίντεο που αναφέρω στο κανάλι μου στο TikTok.


## Αρχεία και Δεδομένα

<ul class="post-list">
{% for post in site.posts %}
	<li>
		<a href="{{ post.url }}">{{ post.title }}</a>
		{% if post.media %}
		<ul class="post-media">
			{% for m in post.media %}
			{% case m.type | downcase %}
			{% when "image" %}{% assign pre = "🏞️" %}
			{% when "video" %}{% assign pre = "📼" %}
			{% else %}{% assign pre = "Media" %}
			{% endcase %}
			<li><strong>{{ pre }}:</strong> <a href="{{ m.url }}" target="_blank">{{ m.caption | default: m.url }}</a></li>
			{% endfor %}
		</ul>
		{% endif %}
	</li>
{% endfor %}
</ul>

* [Polas Spectrum - Μοντέλο Αξιών Κομμάτων](/polas-spectrum)

## Τα Στοιχεία μου

* Support me on [Patreon](https://www.patreon.com/PolasReport){:target="_blank"}
* YouTube: [@polasreport](https://www.youtube.com/@polas-report){:target="_blank"}
* TikTok: [@thanpolas_gr](https://www.tiktok.com/@thanpolas){:target="_blank"}
* Twitter: [@thanpolas_gr](https://twitter.com/thanpolas_gr){:target="_blank"}
* Facebook: [than.polas](https://www.facebook.com/than.polas){:target="_blank"}
* Instagram: [@thanpolas](https://www.instagram.com/thanpolas){:target="_blank"}


