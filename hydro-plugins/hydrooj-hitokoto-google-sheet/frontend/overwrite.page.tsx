import { addPage, NamedPage } from '@hydrooj/ui-default';
import { request } from '@hydrooj/ui-default/utils/base';
function getElementByXPath(xpath: string): HTMLElement {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
}

addPage(new NamedPage(['homepage'], async () => {
  const targetElement = getElementByXPath("//*[@id=\"panel\"]/div[3]/div/div[2]/div[1]") as HTMLElement;
  targetElement.innerHTML = `
  <div class="section__header">
    <h1 class="section__title">一言</h1>
  </div>
  <div class="section__body typo">
    <p>${'無法取得一言'}</p>
    <p style="font-size: smaller; text-align: right;">－－${'未知來源'}</p>
  </div>
`;
  request.get('/hitokoto').then((data : any) => {
    targetElement.innerHTML = `
  <div class="section__header">
    <h1 class="section__title">一言</h1>
  </div>
  <div class="section__body typo">
    <p>${data[0] || '無法取得一言'}</p>
    <p style="font-size: smaller; text-align: right;">－－${data[1] || '未知來源'}</p>
  </div>
`;
  });
}));