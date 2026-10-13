
gsap.registerPlugin(ScrollTrigger);

(function selWorkInit() {
    const section = document.querySelector("[data-sel-work]");
    if (!section) return;

    const list = section.querySelector("[data-sel-work-list]");
    const data = gsap.utils.toArray(section.querySelectorAll("[data-sel-work-item]")).map(item => ({
        row: item.querySelector("[data-sel-work-row]"),
        visual: item.querySelector("[data-sel-work-visual]"),
        // desc: item.querySelector(".sel-work-description"),
        wrap: item.querySelector("[data-sel-work-image-wrap]"),
        img: item.querySelector("img")
    }));

    // 初始状态（图片位置/尺寸已在 CSS 里写好，这里只设动画属性）
    gsap.set(list, { marginTop: 0 });
    data.forEach((d, i) => {
        gsap.set(d.wrap, {
            zIndex: data.length - i,          // 前面的图永远盖在后面的图上
            transformOrigin: "100% 0%",       // 统一向右上角收缩
            scale: 1,
            clipPath: i === 0 ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)"
        });
        gsap.set(d.img, { scale: i === 0 ? 1 : 1.25 });
        gsap.set(d.desc, { autoAlpha: i === 0 ? 1 : 0, y: i === 0 ? 0 : 30 });
    });

    const tl = gsap.timeline({
        defaults: { ease: "none" },           // 与滚动 1:1，滑多少动多少
        scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => "+=" + window.innerHeight * (data.length - 1) * 1.1,
            pin: true,
            anticipatePin: 1,
            scrub: 0.5,
            invalidateOnRefresh: true
        }
    });

    data.slice(0, -1).forEach((cur, i) => {
        const n = i + 1, next = data[n];

        // 旧文案：上移 + 渐隐
        tl.to(cur.desc, { y: -40, autoAlpha: 0, duration: 0.5, ease: "power2.out" }, i)

            // 折叠：容器高度收缩到 0
            .to(cur.visual, { height: 0, duration: 1 }, i)

            // 旧图：容器与图片同比例缩小到右上角
            .to(cur.wrap, { scale: 0, duration: 1 }, i)

            // 新图：从底部向上擦除展开 + 轻微缩放回位
            .to(next.wrap, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9 }, i + 0.1)
            .to(next.img, { scale: 1, duration: 1 }, i)

            // 新文案：面板露出一半后再入场
            .to(next.desc, { y: 0, autoAlpha: 1, duration: 0.55, ease: "power2.out" }, i + 0.45);

        // 从第 3 项起，列表每次上推 1 个标题行；旧图同步上移，保持贴着标题行下沿
        if (n >= 2) {
            tl.to(cur.wrap, { y: () => -cur.row.offsetHeight, duration: 1 }, i)
                .to(list, {
                    marginTop: () => -data.slice(0, n - 1).reduce((s, d) => s + d.row.offsetHeight, 0),
                    duration: 1
                }, i);
        }
    });
})();
