"use strict";
// note 2018.08.29 优化脚本的初始方法和使用方法;
// 				   1.修改getParameter方法-如果请求空数据，那么返回整个参数表
//				   2.新增getParameter方法的第二个参数可以指定其他链接地址
// note 2018.08.28 List版本中的deltaIndex没有初始化，导致不写deltaIndex的时候acid替换为NaN
// note 2018.08.24 dev版本，新增空格匹配，不知道会不会影响正则的匹配结果
// note 2018.08.23 直接不要其他特殊参数，任意匹配
// note 2018.08.21 修复http特殊参数的问题
var acRender = acRender || {};
acRender = (function(){
    /***********注意js代码不能直接嵌入到jsp文档中去，如果直接嵌入，会导致代码执行错误，主要是/转码导致的问题************/

    /**
     * doExtract(resultJson);
     * doExtract(resultJson, "", 1...6);
     * doExtract(resultJson, "#template", 1...6);
     * @param JsonNodeOrJson          解析的JSON节点
     * @param templateSelector  [可选] 目标模板的选择器 | 自动选择 text/html 可以为null，然后设置之后的ID
     * @param settleIndex       [可选] 目标的设置编号ID == $(acid)
     * @returns {*}  遍历文档，尝试使用eval对没解析出来的结果进行解析
     */
    acRender.doExtract = function(JsonNodeOrJson, templateSelector, settleIndex){
        /***********注意js代码不能直接嵌入到jsp文档中去，如果直接嵌入，会导致代码执行错误，主要是/转码导致的问题************/
        /**
         * @param jsonNode          解析的JSON节点
         * @param templateSelector  [可选] 目标模板的选择器 | 自动选择 text/html
         * @param settleIndex       [可选] 目标的设置编号ID == $(acid)
         * @returns {*}  遍历文档，尝试使用eval对没解析出来的结果进行解析
         * doExtract(resultJson, "#template", 6);
         */
        function deepExtract(jsonNode, tHTML, settleIndex){
            for(var key in jsonNode){
                if(!(jsonNode[key] instanceof Object)){
                    let reg = new RegExp("\\$\\("+key+"\\)", "igm");
                    // console.log(reg);
                    tHTML = tHTML.replace(reg, jsonNode[key]);
                }else{
                    // 如果是Object则递归
                    tHTML = deepExtract(jsonNode[key], tHTML);
                }
            }
            return tHTML;
        }
        /**
         * @param tHTML  原始html文档
         * @returns {*}  遍历文档，尝试使用eval对没解析出来的结果进行解析
         */
        function jsEval(tHTML){
            // $("https://www.baidu.com?key=abc&name=%3D".replace("baidu", 0==1?0:1))
            // var reg = /\$\(([\w +\-*\/().#',;=:?&%|\^\$@"]+)\)/igm;
            var reg = /\$\(([\S ]+)\)/igm;
            try{
                tHTML = tHTML.replace(reg, function(per, _){
                    let data,result;
                    data = result = "";
                    try{
                        data = new Function('', 'return '+_+";");
                        result = data(_);
                    }catch (e) {
                        console.log(e);
                    }
                    return result;
                });
            }catch(e){
                // console.log(e);
            }
            return tHTML;
        }
        var jsonNode = typeof(JsonNodeOrJson)==="string"?JSON.parse(JsonNodeOrJson):JsonNodeOrJson;

        // 1. 先获取template模板信息
        templateSelector = templateSelector || "script[type='text/html']";
        var tHTML = document.querySelector(templateSelector).innerHTML;

        // 2. 处理$(acid)的自动编号问题
        if(settleIndex+"" != "undefined") tHTML = tHTML.replace(/\$\(acid\)/igm, settleIndex);

        // 3. 处理文档中的$(key)的键值映射
        tHTML = deepExtract(jsonNode, tHTML, settleIndex);

        // 4. 处理文档中的特殊js代码语句 $(Math.max(2, 5))
        tHTML = jsEval(tHTML);

        // 5. 正常返回
        return tHTML;
    }

    /**
     * doExtractList(resultJsonList);
     * doExtractList(resultJsonList, null, delta=1);
     * @param JsonNodeOrJson   JsonNodeOrJson          解析的JSON节点
     * @param templateSelector templateSelector  [可选] 目标模板的选择器 | 自动选择 text/html 可以为null，然后设置之后的ID
     * @param deltaIndex       相对ID的增长值；可正可负，用来调整acid的值，[acid=0]
     * @returns {string}       返回遍历节点的数据结果值
     */
    acRender.doExtractList = function(JsonNodeOrJson, templateSelector, deltaIndex){
        let result ="";
        deltaIndex = deltaIndex || 0;
        var jsonNode = typeof(JsonNodeOrJson)==="string"?JSON.parse(JsonNodeOrJson):JsonNodeOrJson;
        for(let i=0; i < jsonNode.length; i++){
            result += this.doExtract(jsonNode[i], templateSelector, i+deltaIndex);
        }
        return result;
    }

    /**
     * html格式化，使之成为可显示文本
     * @param sHtml		转换所有的特殊字符为html可显示内容，用于在<a href>DATA</a>中显示<div>或者特殊标签之类的
     * @returns {void | string}
     */
    acRender.htmlEscape = function(sHtml){
        return sHtml.replace(/[<>&"]/g,function(c){return {
            '<':'&lt;',
            '>':'&gt;',
            '&':'&amp;',
            '"':'&quot;'
        }[c];});
    }

    var pama=null;
	/**
         * 提取url的请求
         * @param key
         * @returns {*}
         */
    acRender.getParameter = function(key, url){
        let b = "";
        let pas = location.href;
        if(pas.indexOf("?")<0) return b;
        // 如果pama初始化了 && key有效 && url无效=[请求的location.href]
        if(this.pama != null && this.checkDataUseFul(key) && !this.checkDataUseFul(url)){
            return this.pama[key];
        }else{
        	// 如果url无效=[请求的location.href]
        	if(!this.checkDataUseFul(url)){
                this.pama = new Array();
			}else{
        		pas = url;
			}
            pas = pas.substring(pas.indexOf("?")+1);
            let pass = pas.split("&");
            for(var i=0; i < pass.length; i++){
                let kv = pass[i].split("=");
                // 如果不是""
                if(kv[0].length>0){
                    let k = kv[0];
                    let v = kv.length==2?kv[1]:"";
                    if(!this.checkDataUseFul(url)) this.pama[k] = v;
                    if(k == key) b = v;
                }
            }
        }
        return b != ""?b:this.pama;
    }

    /**
	 * 文本的链接转为可点击的链接-用于外部文档转链
     * @param node 目标区域
     */
    acRender.textToLink = function (node) {
        var clearLink, excludedTags, linkFilter, linkPack, linkify, observePage, setLink, urlPrefixes, url_regexp, xPath;
        url_regexp = /((https?:\/\/|www\.)[\x21-\x7e]+[\w\/=]|\w([\w._-])+@\w[\w\._-]+\.(com|cn|org|net|info|tv|cc|gov|edu)|(\w[\w._-]+\.(com|cn|org|net|info|tv|cc|gov|edu))(\/[\x21-\x7e]*[\w\/])?|ed2k:\/\/[\x21-\x7e]+\|\/|thunder:\/\/[\x21-\x7e]+=)/gi;
        urlPrefixes = ['http://', 'https://'];

        clearLink = function (event) {
            var j, len, link, prefix, ref, ref1, url;
            link = (ref = event.originalTarget) != null ? ref : event.target;
            if (!(link != null && link.localName === "a" && ((ref1 = link.className) != null ? ref1.indexOf("textToLink") : void 0) !== -1)) {
                return;
            }
            url = link.getAttribute("href");
            for (j = 0, len = urlPrefixes.length; j < len; j++) {
                prefix = urlPrefixes[j];
                if (url.indexOf(prefix) === 0) {
                    return;
                }
            }
        };
        document.addEventListener("mouseover", clearLink);
        setLink = function (candidate) {
            var ref, ref1, ref2, span, text;
            if (candidate == null || ((ref = candidate.parentNode) != null ? (ref1 = ref.className) != null ? typeof ref1.indexOf === "function" ? ref1.indexOf("textToLink") : void 0 : void 0 : void 0) !== -1 || candidate.nodeName === "#cdata-section") {
                return;
            }
            text = candidate.textContent.replace(url_regexp, '<a href="$1" target="_blank" class="textToLink">$1</a>');
            if (((ref2 = candidate.textContent) != null ? ref2.length : void 0) === text.length) {
                return;
            }
            span = document.createElement("span");
            span.innerHTML = text;
            return candidate.parentNode.replaceChild(span, candidate);
        };

        excludedTags = "a,svg,canvas,applet,input,button,area,pre,embed,frame,frameset,head,iframe,img,option,map,meta,noscript,object,script,style,textarea,code".split(",");

        xPath = '//text()[not(ancestor::' + excludedTags.join(') and not(ancestor::') + ')]';

        linkPack = function (result, start) {
            var i, j, k, ref, ref1, ref2, ref3, startTime;
            startTime = Date.now();
            while (start + 10000 < result.snapshotLength) {
                for (i = j = ref = start, ref1 = start + 10000; ref <= ref1 ? j <= ref1 : j >= ref1; i = ref <= ref1 ? ++j : --j) {
                    setLink(result.snapshotItem(i));
                }
                start += 10000;
                if (Date.now() - startTime > 2500) {
                    return;
                }
            }
            for (i = k = ref2 = start, ref3 = result.snapshotLength; ref2 <= ref3 ? k <= ref3 : k >= ref3; i = ref2 <= ref3 ? ++k : --k) {
                setLink(result.snapshotItem(i));
            }
        };

        linkify = function (node) {
            var result;
            result = document.evaluate(xPath, node, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
            return linkPack(result, 0);
        };

        linkFilter = function (node) {
            var j, len, tag;
            for (j = 0, len = excludedTags.length; j < len; j++) {
                tag = excludedTags[j];
                if (tag === node.parentNode.localName.toLowerCase()) {
                    return NodeFilter.FILTER_REJECT;
                }
            }
            return NodeFilter.FILTER_ACCEPT;
        };
        if (window !== window.top || window.document.title === "") {
            return;
        }
        linkify(node);
    }

    /**
	 * 检查数据是否为有效数据
     * @param data	目标数据
     * @returns {boolean} 有效:true; 无效:false
     */
    acRender.checkDataUseFul = function(data){
    	return !(typeof(data) == "undefined" || data == null || data == "");
	}

	/**
     * 返回是否滚动到底=加载更多数据
	 * @returns {boolean} 返回是否应该加载更多数据了 == 是否到底
	 */
	acRender.shouldLoadMore = function(){
		//文档高度
		function getDocumentTop() {
			var scrollTop = 0, bodyScrollTop = 0, documentScrollTop = 0;
			if (document.body) {
				bodyScrollTop = document.body.scrollTop;
			}
			if (document.documentElement) {
				documentScrollTop = document.documentElement.scrollTop;
			}
			scrollTop = (bodyScrollTop - documentScrollTop > 0) ? bodyScrollTop : documentScrollTop;
			return scrollTop;
		}

		//可视窗口高度
		function getWindowHeight() {
			var windowHeight = 0;
			if (document.compatMode == "CSS1Compat") {
				windowHeight = document.documentElement.clientHeight;
			} else {
				windowHeight = document.body.clientHeight;
			}
			return windowHeight;
		}

		//滚动条滚动高度
		 function getScrollHeight() {
			var scrollHeight = 0, bodyScrollHeight = 0, documentScrollHeight = 0;
			if (document.body) {
				bodyScrollHeight = document.body.scrollHeight;
			}
			if (document.documentElement) {
				documentScrollHeight = document.documentElement.scrollHeight;
			}
			scrollHeight = (bodyScrollHeight - documentScrollHeight > 0) ? bodyScrollHeight : documentScrollHeight;
			return scrollHeight;
		}
		return getScrollHeight() == getWindowHeight() + getDocumentTop();
    }

	return {
        doExtract : acRender.doExtract,
        doExtractList : acRender.doExtractList,
        htmlEscape : acRender.htmlEscape,
        getParameter : acRender.getParameter,
        textToLink : acRender.textToLink,
        checkDataUseFul : acRender.checkDataUseFul,
		shouldLoadMore : acRender.shouldLoadMore,
	}
})();
